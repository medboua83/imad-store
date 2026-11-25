"""Fictional fixtures only; never connect to an existing cluster or merchant."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("offsite", Path(__file__).parents[1] / "scripts/offsite-recovery.py")
v = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(v)


class OffsiteRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name).resolve(); self.folder.chmod(0o700)

    def put(self, name, data):
        p = self.folder / name; p.write_bytes(data); p.chmod(0o600); return p

    def tar(self, name, members, gz=False):
        p = self.folder / name
        with tarfile.open(p, "w:gz" if gz else "w") as archive:
            for name, data, kind in members:
                m = tarfile.TarInfo(name); m.type = kind; m.size = len(data) if kind == tarfile.REGTYPE else 0
                m.mode = 0o600
                if kind in [tarfile.SYMTYPE, tarfile.LNKTYPE]: m.linkname = "/etc/passwd"
                archive.addfile(m, io.BytesIO(data) if m.size else None)
        p.chmod(0o600); return p

    def snapshot(self):
        photo = b"RIFF\x00\x00\x00\x00WEBPfictional-photo"
        photo_name = hashlib.sha256(photo).hexdigest() + ".webp"
        self.tar("uploads.tar.gz", [("uploads/" + photo_name, photo, tarfile.REGTYPE)], True)
        app = b'DATABASE_URL=postgresql://fictional:fictional@127.0.0.1/fictional\nJWT_SECRET=' + b'a'*40 + b'\nJWT_REFRESH_SECRET=' + b'b'*40 + b'\nDESKCOMM_ENCRYPTION_KEY=' + b'c'*64 + b'\n'
        self.put("app.env", app); self.put("migrate.env", b'DATABASE_URL=postgresql://owner:fictional@127.0.0.1/fictional\n')
        self.put("store.dump", b"fictional-dump")
        self.put("snapshot.json", json.dumps({"sourceCommit": "a" * 40}).encode())
        self.tar("source.tar.gz", [(name, b"{}", tarfile.REGTYPE) for name in ["package.json", "package-lock.json", "backend/prisma/schema.prisma", "server.js"]], True)
        self.rehash()
        return photo_name

    def rehash(self):
        self.put("SHA256SUMS", ("\n".join(v.sha(self.folder / n) + "  " + n for n in sorted(v.BACKUP.FILES)) + "\n").encode())

    def test_snapshot_requires_database_photos_keys_and_source(self):
        self.snapshot(); self.assertEqual(v.validate_snapshot(self.folder)["photos"]["photos"], 1)
        (self.folder / "source.tar.gz").unlink()
        with self.assertRaises(ValueError): v.validate_snapshot(self.folder)

    def test_snapshot_rejects_silent_corruption(self):
        self.snapshot(); self.put("store.dump", b"changed")
        with self.assertRaises(ValueError): v.validate_snapshot(self.folder)

    def test_source_archive_rejects_links_traversal_and_duplicates(self):
        for i, (name, kind) in enumerate([("../escape", tarfile.REGTYPE), ("/absolute", tarfile.REGTYPE), ("link", tarfile.SYMTYPE), ("hardlink", tarfile.LNKTYPE)]):
            with self.subTest(name=name), self.assertRaises(ValueError):
                v.validate_source(self.tar(str(i) + ".gz", [(name, b"test", kind)], True))
        with self.assertRaises(ValueError):
            v.validate_source(self.tar("duplicates.gz", [("file", b"test", tarfile.REGTYPE)]*2, True))

    def test_outer_archive_rejects_unknown_members_and_links(self):
        for i, (name, kind) in enumerate([("../escape", tarfile.REGTYPE), ("store.dump", tarfile.SYMTYPE), ("not-allowed", tarfile.REGTYPE)]):
            dest = self.folder / ("out" + str(i)); dest.mkdir(mode=0o700)
            with self.subTest(name=name), self.assertRaises(ValueError):
                v.unpack(self.tar(str(i) + ".tar", [(name, b"test", kind)]), dest)
            self.assertFalse((self.folder / "escape").exists())

    def test_outer_archive_requires_complete_authenticated_manifest(self):
        dest = self.folder / "out"; dest.mkdir(mode=0o700)
        with self.assertRaises(ValueError):
            v.unpack(self.tar("missing.tar", [("store.dump", b"test", tarfile.REGTYPE)]), dest)

    def test_no_existing_output_is_overwritten(self):
        p = self.put("existing", b"keep")
        with self.assertRaises(ValueError): v.write_new(p, b"replace")
        self.assertEqual(p.read_bytes(), b"keep")

    def test_symlinked_or_public_output_folder_is_rejected(self):
        link = self.folder / "link"; link.symlink_to(self.folder, target_is_directory=True)
        with self.assertRaises(ValueError): v.new_output(link / "output")
        self.folder.chmod(0o755)
        with self.assertRaises(ValueError): v.new_output(self.folder / "output")
        self.folder.chmod(0o700)

    def test_no_live_environment_is_inherited_or_sql_error_echoed(self):
        class Result:
            returncode=1; stdout=b"private-row"; stderr=b"private-password"
        with patch.dict(os.environ, {"PGHOST": "live.invalid", "DATABASE_URL": "private-password"}), patch.object(v.subprocess, "run", return_value=Result()) as run:
            with self.assertRaisesRegex(RuntimeError, "Recovery tool failed: psql") as error:
                v.run(["/bin/psql"])
        self.assertNotIn("private", str(error.exception))
        self.assertEqual(set(run.call_args.kwargs["env"]), {"PATH", "LANG", "LC_ALL", "TZ"})

    def test_failed_cluster_stop_retains_own_private_workspace(self):
        work = v.PrivateWorkspace(self.folder)
        with self.assertRaises(RuntimeError):
            with work as p:
                (p / "pg").mkdir(); (p / "pg/postmaster.pid").write_text("fictional")
        self.assertTrue((work.path / "pg/postmaster.pid").exists())

    def test_success_or_precluster_failure_removes_plaintext(self):
        with self.assertRaises(ValueError):
            with v.PrivateWorkspace(self.folder) as p:
                (p / "private.env").write_text("fictional"); raise ValueError("fixture")
        self.assertFalse(p.exists())

    def test_database_fingerprint_covers_all_rows_and_sequences(self):
        def sql(command):
            if "pg_tables" in command:return b"products\norders\n" + b"\n".join(("fixture"+str(i)).encode() for i in range(8)) + b"\n"
            if "COPY" in command:return b'{"photo":"/uploads/' + b"a"*64 + b'.webp"}\n'
            if "pg_constraint" in command:return b"0"
            if "pg_sequences" in command:return b"[]"
            raise AssertionError(command)
        proof, images = v.fingerprint(sql)
        self.assertEqual(len(proof["tables"]), 10); self.assertEqual(proof["tables"]["orders"]["rows"], 1)
        self.assertEqual(images, {"a"*64+".webp"}); self.assertEqual(proof["unvalidatedConstraints"], 0)

    @unittest.skipUnless(os.environ.get("IMAD_RECOVERY_PG_BIN") and shutil.which("age") and shutil.which("node"), "Set IMAD_RECOVERY_PG_BIN for the isolated encryption/PG rehearsal")
    def test_real_encryption_restore_twice_wrong_key_corruption_and_cleanup(self):
        photo = self.snapshot()
        pg = Path(os.environ["IMAD_RECOVERY_PG_BIN"]); age = shutil.which("age"); node = shutil.which("node")
        source = self.folder / "source-cluster"; source.mkdir(mode=0o700)
        sock = source / "s"; sock.mkdir(mode=0o700)
        data = source / "pg"
        v.run([pg/"initdb", "-D", data, "-U", "fixture", "--auth-local=trust", "--auth-host=reject", "--no-locale", "--encoding=UTF8"])
        conn = ["--host="+str(sock), "--port=55495", "--username=fixture"]
        try:
            v.run([pg/"pg_ctl", "-D", data, "-l", source/"log", "-o", "-h '' -k "+str(sock)+" -p 55495", "-w", "start"])
            sql = "CREATE TABLE products(id int PRIMARY KEY,photo text); INSERT INTO products VALUES (1,'/uploads/"+photo+"');"
            sql += "".join("CREATE TABLE fixture"+str(i)+"(id int PRIMARY KEY);" for i in range(9))
            v.run([pg/"psql", *conn, "-X", "--set=ON_ERROR_STOP=1", "--dbname=postgres", "-c", sql])
            self.put("store.dump", v.run([pg/"pg_dump", *conn, "-Fc", "--dbname=postgres"]))
        finally:
            if (data/"postmaster.pid").exists():v.run([pg/"pg_ctl", "-D", data, "-m", "fast", "-w", "stop"])
        shutil.rmtree(source); self.rehash()
        # Seal accepts only snapshot files; cryptographic tools live next door.
        snapshot = self.folder/"snapshot"; snapshot.mkdir(mode=0o700)
        for p in list(self.folder.iterdir()):
            if p != snapshot:p.rename(snapshot/p.name)
        key = self.put("identity", subprocess.run([shutil.which("age-keygen")],capture_output=True,check=True).stdout)
        recipient = self.put("recipient", subprocess.run([shutil.which("age-keygen"),"-y",str(key)],capture_output=True,check=True).stdout)
        archive = self.folder/"archive.age"; sealed = v.seal(snapshot, recipient, archive, age)
        # Ciphertext must not contain any profile or photo bytes.
        self.assertNotIn(b"JWT_SECRET=", archive.read_bytes()); self.assertNotIn(b"fictional-photo", archive.read_bytes())
        workspace = self.folder/"work"; workspace.mkdir(mode=0o700)
        results=[]
        for i in range(2):
            results.append(v.probe(archive,key,workspace,pg,age,node,self.folder/("proof"+str(i)+".json"),sealed["encryptedSha256"]))
            self.assertEqual(list(workspace.iterdir()), [])
        self.assertEqual(results[0]["restoredDatabase"],results[1]["restoredDatabase"])
        self.assertTrue(results[0]["privateProfiles"]["authenticationKeysPresent"])
        wrong = self.put("wrong-key", subprocess.run([shutil.which("age-keygen")],capture_output=True,check=True).stdout)
        with self.assertRaises(RuntimeError):v.probe(archive,wrong,workspace,pg,age,node,self.folder/"wrong.json")
        self.assertEqual(list(workspace.iterdir()), [])
        raw=bytearray(archive.read_bytes());raw[-8]^=1;broken=self.put("corrupt.age",raw)
        with self.assertRaises(RuntimeError):v.probe(broken,key,workspace,pg,age,node,self.folder/"corrupt.json")
        self.assertEqual(list(workspace.iterdir()), [])
        with self.assertRaises(ValueError):v.probe(archive,key,workspace,pg,age,node,self.folder/"digest.json","0"*64)
        # A cryptographically valid but incomplete snapshot must still fail.
        photos=snapshot/"uploads.tar.gz";original=photos.read_bytes()
        empty=self.tar("empty-photos.gz",[],True);photos.write_bytes(empty.read_bytes());empty.unlink()
        sums=snapshot/"SHA256SUMS"
        sums.write_text("\n".join(v.sha(snapshot/n)+"  "+n for n in sorted(v.BACKUP.FILES))+"\n")
        missing=self.folder/"missing-photos.age";v.seal(snapshot,recipient,missing,age)
        with self.assertRaises(ValueError):v.probe(missing,key,workspace,pg,age,node,self.folder/"missing-photos.json")
        self.assertEqual(list(workspace.iterdir()), [])
        photos.write_bytes(original)
        app=snapshot/"app.env";app.write_text(app.read_text().replace('DESKCOMM_ENCRYPTION_KEY=', 'WRONG_KEY='))
        sums.write_text("\n".join(v.sha(snapshot/n)+"  "+n for n in sorted(v.BACKUP.FILES))+"\n")
        missingkey=self.folder/"missing-key.age";v.seal(snapshot,recipient,missingkey,age)
        with self.assertRaises(RuntimeError):v.probe(missingkey,key,workspace,pg,age,node,self.folder/"missing-key.json")
        self.assertEqual(list(workspace.iterdir()), [])


if __name__ == "__main__": unittest.main()
