#!/usr/bin/env python3
"""Seal a private snapshot, or rehearse recovery in a NEW disposable PG cluster.

No live database URL, existing PG cluster, application profile or worker is loaded.
Only age-encrypted archives are kept; plaintext and the new cluster are removed.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

SPEC = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("verify-store-backup.py"))
BACKUP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BACKUP)
REQUIRED = BACKUP.FILES | {"SHA256SUMS", "source.tar.gz", "snapshot.json"}
OPTIONAL = {"source-release.txt", "source-patch.json", "runtime-service.txt", "manifest.json", "permissions.json"}
MANIFEST = "recovery-manifest.json"
MAX_BYTES = 30 * 1024 ** 3


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def private(path, directory=False):
    return BACKUP.private_path(Path(path), directory)


def new_output(path):
    path = Path(path)
    private(path.parent, True)
    if not path.is_absolute() or path.exists() or path.is_symlink() or path.name in {".", ".."}:
        raise ValueError("A new absolute private output is required")
    return path


def write_new(path, data):
    fd = os.open(new_output(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(data)


def run(command, *, source=None, timeout=600):
    # No PG*, application credentials, shell startup or user profiles inherited.
    env = {"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C", "TZ": "UTC"}
    result = subprocess.run(list(map(str, command)), input=source, capture_output=True, env=env, timeout=timeout)
    if result.returncode:
        # Never expose SQL rows, connection details, keys or tool stderr.
        raise RuntimeError("Recovery tool failed: " + Path(command[0]).name)
    return result.stdout


class PrivateWorkspace:
    """Never remove the data directory of a cluster that might still run."""
    def __init__(self, parent):
        self.path = Path(tempfile.mkdtemp(prefix="recovery-", dir=parent))
        self.path.chmod(0o700)

    def __enter__(self):
        return self.path

    def __exit__(self, *exc):
        if (self.path / "pg" / "postmaster.pid").exists():
            raise RuntimeError("Recovery cluster stop requires operator review; private workspace retained")
        shutil.rmtree(self.path)


def validate_source(path):
    seen, total = set(), 0
    with tarfile.open(path, "r|gz") as archive:
        for m in archive:
            name = m.name.rstrip("/")
            parts = Path(name).parts
            if not parts or name.startswith("/") or ".." in parts or name in seen:
                raise ValueError("Unsafe or duplicate source member")
            seen.add(name)
            if not (m.isfile() or m.isdir()) or m.size > 100 * 1024 ** 2:
                raise ValueError("Source links or large members are not accepted")
            total += m.size
            if total > 2 * 1024 ** 3 or len(seen) > 100_000:
                raise ValueError("Source archive limit exceeded")
    for name in ["package.json", "package-lock.json", "backend/prisma/schema.prisma", "server.js"]:
        if name not in seen:
            raise ValueError("Recovery source is incomplete")
    return len(seen)


def validate_snapshot(folder):
    folder = private(folder, True)
    names = {p.name for p in folder.iterdir()}
    if not REQUIRED <= names or not names <= REQUIRED | OPTIONAL:
        raise ValueError("Unexpected or missing snapshot files")
    for name in names:
        private(folder / name)
    BACKUP.checksum_manifest(folder)
    photos = BACKUP.verify_uploads(folder / "uploads.tar.gz")
    source_files = validate_source(folder / "source.tar.gz")
    meta = json.loads((folder / "snapshot.json").read_text())
    if not re.fullmatch(r"[a-f0-9]{40}", meta.get("sourceCommit", "")):
        raise ValueError("A compatible source revision is required")
    return {"photos": photos, "sourceFiles": source_files, "sourceCommit": meta["sourceCommit"]}


def seal(folder, recipient, output, age):
    folder, recipient = private(folder, True), private(recipient)
    output = new_output(output)
    proof = validate_snapshot(folder)
    recipients = recipient.read_text().strip().splitlines()
    if len(recipients) != 1 or not re.fullmatch(r"age1[0-9a-z]{50,100}", recipients[0]):
        raise ValueError("One native public age recipient is required")
    manifest = {p.name: sha(p) for p in sorted(folder.iterdir())}
    # Stream tar into age, never retain an unencrypted consolidated archive.
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "wb") as target, tempfile.TemporaryFile(dir=output.parent) as errors:
            process = subprocess.Popen([str(age), "--encrypt", "-R", str(recipient)], stdin=subprocess.PIPE,
                                       stdout=target, stderr=errors)
            try:
                with tarfile.open(fileobj=process.stdin, mode="w|") as archive:
                    import io
                    data = json.dumps({"format": 1, "files": manifest}, sort_keys=True).encode()
                    entry = tarfile.TarInfo(MANIFEST); entry.size = len(data); entry.mode = 0o600
                    archive.addfile(entry, io.BytesIO(data))
                    for p in sorted(folder.iterdir()):
                        archive.add(p, arcname=p.name, recursive=False)
                process.stdin.close()
                if process.wait(timeout=600):
                    raise RuntimeError("Encryption failed")
            finally:
                if process.poll() is None:
                    process.kill(); process.wait()
            target.flush(); os.fsync(target.fileno())
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    return {**proof, "encryptedBytes": output.stat().st_size, "encryptedSha256": sha(output)}


def unpack(archive, destination):
    """Strictly copy flat regular members; tar.extract* is deliberately not used."""
    seen, total = set(), 0
    with tarfile.open(archive, "r|") as entries:
        for member in entries:
            name = member.name
            if name not in REQUIRED | OPTIONAL | {MANIFEST} or name in seen or not member.isfile():
                raise ValueError("Unexpected, duplicate or linked recovery member")
            if member.size < 0 or member.size > MAX_BYTES:
                raise ValueError("Recovery member limit exceeded")
            seen.add(name); total += member.size
            if total > MAX_BYTES:
                raise ValueError("Recovery archive limit exceeded")
            with entries.extractfile(member) as source:
                fd = os.open(destination / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, "wb") as target:
                    shutil.copyfileobj(source, target, 1024 * 1024)
    if not REQUIRED | {MANIFEST} <= seen:
        raise ValueError("Incomplete recovery archive")
    manifest = json.loads((destination / MANIFEST).read_text())
    if manifest.get("format") != 1 or set(manifest.get("files", {})) != seen - {MANIFEST}:
        raise ValueError("Unexpected recovery manifest")
    for name, digest in manifest["files"].items():
        if not re.fullmatch(r"[a-f0-9]{64}", digest) or sha(destination / name) != digest:
            raise ValueError("Recovery member checksum mismatch")
    (destination / MANIFEST).unlink()
    return validate_snapshot(destination)


def restore_photos(archive, target):
    BACKUP.verify_uploads(archive)
    target.mkdir(mode=0o700)
    with tarfile.open(archive, "r|gz") as entries:
        for member in entries:
            if member.isdir():
                continue
            name = Path(member.name).name
            with entries.extractfile(member) as source:
                write_new(target / name, source.read())
    return {p.name for p in target.iterdir()}


def fingerprint(psql):
    tables = psql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").decode().splitlines()
    if len(tables) < 10:
        raise ValueError("Incomplete restored schema")
    result, images = {}, set()
    for table in tables:
        if not re.fullmatch(r"[a-zA-Z_][a-zA-Z_0-9]*", table):
            raise ValueError("Unexpected table identifier")
        rows = psql('COPY (SELECT to_jsonb(t)::text FROM public."' + table + '" t ORDER BY to_jsonb(t)::text COLLATE "C") TO STDOUT')
        result[table] = {"rows": rows.count(b"\n"), "sha256": hashlib.sha256(rows).hexdigest()}
        images.update(m.decode() for m in re.findall(rb"/uploads/([a-f0-9]{64}\.webp)", rows))
    constraints = int(psql("SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT c.convalidated"))
    if constraints:
        raise ValueError("Unvalidated restored constraints")
    sequences = psql("SELECT coalesce(json_agg(x ORDER BY sequencename)::text,'[]') FROM (SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname='public') x")
    return {"tables": result, "sequencesSha256": hashlib.sha256(sequences).hexdigest(),
            "unvalidatedConstraints": constraints}, images


PROFILE_CHECK = r"""
const {parseEnv}=require('node:util'),{createDecipheriv}=require('node:crypto');
let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{try{
 const data=JSON.parse(input),app=parseEnv(data.app),migration=parseEnv(data.migration);
 const a=new URL(app.DATABASE_URL),m=new URL(migration.DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(a.protocol)||!['postgres:','postgresql:'].includes(m.protocol)||
    a.hostname!==m.hostname||(a.port||'5432')!==(m.port||'5432')||a.pathname!==m.pathname)
   throw Error('Profiles mismatch');
 if(!app.JWT_SECRET||app.JWT_SECRET.length<32||!app.JWT_REFRESH_SECRET||app.JWT_REFRESH_SECRET.length<32||
    !/^[0-9a-fA-F]{64}$/.test(app.DESKCOMM_ENCRYPTION_KEY||''))throw Error('Required key missing');
 for(const text of data.ciphertexts){
   const parts=text.split('.');if(parts.length!==3)throw Error('Encrypted value invalid');
   const [iv,tag,value]=parts.map(s=>Buffer.from(s,'base64url'));
   const decipher=createDecipheriv('aes-256-gcm',Buffer.from(app.DESKCOMM_ENCRYPTION_KEY,'hex'),iv);
   decipher.setAuthTag(tag);decipher.update(value);decipher.final();
 }
 console.log(JSON.stringify({profilesTargetSameStore:true,authenticationKeysPresent:true,
   integrationKeyPresent:true,encryptedValuesDecrypted:data.ciphertexts.length,noConnectionOpened:true}));
}catch{process.exitCode=1}});
"""


def profiles_check(folder, psql, node):
    columns = json.loads(psql("SELECT coalesce(json_agg(x)::text,'[]') FROM (SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND (lower(column_name) LIKE '%ciphertext' OR (table_name='olivraison_integration' AND column_name='credentials'))) x"))
    encrypted = []
    for col in columns:
        table, column = col["table_name"], col["column_name"]
        if not all(re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", s) for s in [table, column]):
            raise ValueError("Unexpected encrypted column identifier")
        encrypted.extend(json.loads(psql('SELECT coalesce(json_agg("' + column + '")::text,\'[]\') FROM "' + table + '" WHERE "' + column + '" IS NOT NULL')))
    body = {"app": (folder / "app.env").read_text(), "migration": (folder / "migrate.env").read_text(), "ciphertexts": encrypted}
    return json.loads(run([node, "-e", PROFILE_CHECK], source=json.dumps(body).encode()))


def probe(archive, identity, workspace, pg_bin, age, node, output, expected_sha=None):
    archive, identity = private(archive), private(identity)
    pg_bin = Path(pg_bin).resolve(strict=True)
    private(workspace, True)
    new_output(output)
    if not re.fullmatch(r"/[A-Za-z0-9_./-]+", str(workspace)):
        raise ValueError("Choose a private workspace without spaces or control characters")
    if os.geteuid() == 0:
        raise ValueError("Run the disposable cluster as an unprivileged local operator")
    if expected_sha and sha(archive) != expected_sha:
        raise ValueError("Encrypted archive checksum mismatch")
    started = time.monotonic()
    report = None
    with PrivateWorkspace(workspace) as temp:
        temp = Path(temp); temp.chmod(0o700)
        socket_dir = temp / "s"; socket_dir.mkdir(mode=0o700)
        if len(str(socket_dir).encode()) > 80:
            raise ValueError("Choose a shorter private workspace for the isolated Unix socket")
        decrypted = temp / "recovery.tar"
        fd = os.open(decrypted, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as target:
            # Output to an already exclusively opened private file.
            with tempfile.TemporaryFile(dir=temp) as errors:
                proc = subprocess.run([str(age), "--decrypt", "-i", str(identity), str(archive)],
                                      stdout=target, stderr=errors, timeout=600)
                if proc.returncode:
                    raise RuntimeError("Decryption failed")
        snap = temp / "snapshot"; snap.mkdir(mode=0o700)
        proof = unpack(decrypted, snap)
        photos = restore_photos(snap / "uploads.tar.gz", temp / "uploads")
        pgdata = temp / "pg"
        run([pg_bin / "initdb", "-D", pgdata, "-U", "recovery_owner", "--auth-local=trust", "--auth-host=reject", "--no-locale", "--encoding=UTF8"])
        marker = uuid.uuid4().hex
        (pgdata / ".recovery-owner").write_text(marker)
        pg_started = False
        try:
            # Own NEW cluster and socket; never an existing port/cluster or URL.
            run([pg_bin / "pg_ctl", "-D", pgdata, "-l", temp / "postgres.log", "-o",
                 "-h '' -k " + str(socket_dir) + " -p 55495 -c max_connections=20", "-w", "start"])
            pg_started = True
            db = "imad_restore_" + uuid.uuid4().hex
            conn = ["--host=" + str(socket_dir), "--port=55495", "--username=recovery_owner"]
            run([pg_bin / "createdb", *conn, "--template=template0", db])
            run([pg_bin / "pg_restore", *conn, "--no-owner", "--no-acl", "--exit-on-error", "--dbname=" + db, snap / "store.dump"])

            # -q suppresses SET command tags; no row data is written to reports.
            def quiet_psql(sql):
                return run([pg_bin / "psql", *conn, "-XqAt", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--dbname=" + db,
                            "--command=SET timezone='UTC'; SET default_transaction_read_only=on; " + sql])

            database, referenced = fingerprint(quiet_psql)
            profile_proof = profiles_check(snap, quiet_psql, node)
            missing = referenced - photos
            if missing:
                raise ValueError("Restored database references missing product photos")
            report = {"verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "offsiteCopyVerified": True,
                      "encryptedSha256": sha(archive), "snapshot": proof, "restoredDatabase": database,
                      "privateProfiles": profile_proof,
                      "referencedPhotos": len(referenced), "missingPhotos": 0, "photosExtractedAndVerified": len(photos),
                      "newPrivateCluster": True, "tcpListenerEnabled": False, "applicationStarted": False,
                      "externalWorkersStarted": False, "productionDatabaseTargeted": False}
        finally:
            if pg_started or (pgdata / "postmaster.pid").exists():
                assert (pgdata / ".recovery-owner").read_text() == marker
                run([pg_bin / "pg_ctl", "-D", pgdata, "-m", "fast", "-w", "stop"])
        report["plaintextAndClusterRemoved"] = True
        report["seconds"] = round(time.monotonic() - started, 2)
    write_new(output, (json.dumps(report, indent=2) + "\n").encode())
    return report


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    s = sub.add_parser("seal")
    for name in ["snapshot", "recipient", "output", "age"]:
        s.add_argument("--" + name, type=Path, required=True)
    p = sub.add_parser("probe")
    for name in ["archive", "identity", "workspace", "pg-bin", "age", "node", "output"]:
        p.add_argument("--" + name, type=Path, required=True)
    p.add_argument("--expected-sha", required=True, help="SHA-256 received through a trusted channel; encryption does not authenticate the sender")
    a = vars(parser.parse_args()); action = a.pop("action")
    if action == "seal":
        a["folder"] = a.pop("snapshot")
        print(json.dumps(seal(**a)))
    else:
        result = probe(**a)
        print(json.dumps({"offsiteCopyVerified": result["offsiteCopyVerified"], "tables": len(result["restoredDatabase"]["tables"]),
                          "photos": result["photosExtractedAndVerified"], "seconds": result["seconds"],
                          "plaintextAndClusterRemoved": result["plaintextAndClusterRemoved"]}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Recovery stopped (" + type(error).__name__ + "). No live database was targeted.", file=sys.stderr)
        sys.exit(1)
