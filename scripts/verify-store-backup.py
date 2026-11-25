#!/usr/bin/env python3
"""Verify a private store backup by restoring it into a disposable local database.

Never loads an application profile, starts workers, extracts uploads, or connects to
an application database. Only the database successfully created by this run may be
removed. PostgreSQL peer authentication is used through its local Unix socket.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import time
import uuid

FILES = {"store.dump", "uploads.tar.gz", "app.env", "migrate.env"}
RESTORE_NAME = re.compile(r"imad_restore_[a-f0-9]{32}\Z")


def private_path(path, directory=False):
    path = Path(path)
    if not path.is_absolute() or path != path.resolve(strict=True):
        raise ValueError("An absolute private path without symlinks is required")
    info = path.stat()
    if info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError("Backup and report paths must belong to the operator and be private")
    if not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
        raise ValueError("Unexpected backup member type")
    return path


def checksum_manifest(folder):
    folder = private_path(folder, directory=True)
    manifest = private_path(folder / "SHA256SUMS")
    expected = {}
    for line in manifest.read_text(encoding="ascii").splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  (store\.dump|uploads\.tar\.gz|app\.env|migrate\.env)", line)
        if not match or match[2] in expected:
            raise ValueError("Unexpected or duplicate checksum entry")
        expected[match[2]] = match[1]
    if set(expected) != FILES:
        raise ValueError("The backup must include database, photos and both private profiles")
    for name, digest in expected.items():
        path = private_path(folder / name)
        actual = hashlib.sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                actual.update(block)
        if actual.hexdigest() != digest:
            raise ValueError("Backup checksum mismatch")
    return expected


def verify_uploads(archive):
    seen = set()
    total_bytes = 0
    photos = 0
    with tarfile.open(archive, "r|gz") as entries:
        for member in entries:
            name = member.name.rstrip("/")
            if name in seen or len(seen) >= 100_000:
                raise ValueError("Duplicate upload or archive limit exceeded")
            seen.add(name)
            if member.isdir() and name == "uploads":
                continue
            match = re.fullmatch(r"uploads/([a-f0-9]{64})\.webp", name)
            if not match or not member.isfile() or member.size > 20 * 1024 * 1024:
                raise ValueError("Unexpected upload entry, link or photo size")
            total_bytes += member.size
            if total_bytes > 20 * 1024 ** 3:
                raise ValueError("Upload archive size limit exceeded")
            digest = hashlib.sha256()
            source = entries.extractfile(member)
            if source is None:
                raise ValueError("Upload cannot be read")
            prefix = source.read(12)
            if prefix[:4] != b"RIFF" or prefix[8:12] != b"WEBP":
                raise ValueError("Unexpected photo format")
            digest.update(prefix)
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
            if digest.hexdigest() != match[1]:
                raise ValueError("Immutable photo hash mismatch")
            photos += 1
    return {"photos": photos, "photoBytes": total_bytes}


def pg(tool, arguments, source=None):
    # No inherited PG* or application configuration can redirect this probe.
    environment = {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"}
    command = ["/usr/sbin/runuser", "-u", "postgres", "--", "/usr/bin/" + tool,
               "--host=/var/run/postgresql", "--port=5432", *arguments]
    result = subprocess.run(command, stdin=source, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=environment, timeout=300)
    if result.returncode:
        # Restore errors may contain row data; never echo stderr or SQL values.
        raise RuntimeError("PostgreSQL verification command failed: " + tool)
    return result.stdout.decode("utf-8")


def restore_probe(archive):
    name = "imad_restore_" + uuid.uuid4().hex
    if not RESTORE_NAME.fullmatch(name):
        raise ValueError("Invalid disposable database name")
    created = False
    try:
        pg("createdb", ["--maintenance-db=postgres", "--template=template0", name])
        created = True
        with Path(archive).open("rb") as source:
            pg("pg_restore", ["--no-owner", "--no-acl", "--exit-on-error", "--dbname=" + name], source)
        sql = """SELECT json_build_object(
          'tables', (SELECT count(*) FROM pg_tables WHERE schemaname='public'),
          'orders', (SELECT count(*) FROM orders),
          'products', (SELECT count(*) FROM products),
          'variants', (SELECT count(*) FROM product_variants),
          'parcels', (SELECT count(*) FROM olivraison_shipments),
          'unvalidatedConstraints', (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n
              ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT c.convalidated))"""
        summary = json.loads(pg("psql", ["-X", "--no-psqlrc", "--set=ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--dbname=" + name, "--command=" + sql]))
        if summary["tables"] < 10 or summary["unvalidatedConstraints"]:
            raise RuntimeError("Incomplete restored schema")
        return summary
    finally:
        # A collision or failed creation never authorizes dropping another database.
        if created:
            pg("dropdb", ["--maintenance-db=postgres", "--if-exists", "--force", name])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0 or sys.platform != "linux":
        raise ValueError("Run as root on the Linux PostgreSQL host")
    private_path(args.output.parent, directory=True)
    if not args.output.is_absolute() or args.output.parent / args.output.name != args.output or args.output.exists() or args.output.is_symlink():
        raise ValueError("A new absolute private report file is required")
    started = time.monotonic()
    hashes = checksum_manifest(args.backup)
    photos = verify_uploads(args.backup / "uploads.tar.gz")
    database = restore_probe(args.backup / "store.dump")
    report = {"verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "seconds": round(time.monotonic() - started, 2), "checksumsVerified": sorted(hashes),
              "photos": photos, "restoredDatabase": database, "disposableDatabaseRemoved": True,
              "applicationStarted": False, "externalWorkersStarted": False,
              "offsiteCopyVerified": False}
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as target:
        json.dump(report, target, indent=2)
        target.write("\n")
    print("IMAD - SAUVEGARDE RESTAUREE ET VERIFIEE SUR BASE JETABLE")
    print(json.dumps(report))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Backup verification failed (" + type(error).__name__ + "). No application database was targeted.", file=sys.stderr)
        sys.exit(1)
