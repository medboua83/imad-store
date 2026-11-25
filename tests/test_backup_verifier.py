"""Safety contracts; no application database or real backup is accessed."""
import hashlib
import importlib.util
import io
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup_verifier', Path(__file__).parents[1] / 'scripts/verify-store-backup.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

class BackupVerifierTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name).resolve()
        os.chmod(self.folder, 0o700)

    def manifest(self):
        entries=[]
        for name in sorted(v.FILES):
            p=self.folder/name;p.write_bytes(name.encode());p.chmod(0o600)
            entries.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+name)
        p=self.folder/'SHA256SUMS';p.write_text('\n'.join(entries)+'\n');p.chmod(0o600)

    def archive(self, name, content, kind=tarfile.REGTYPE):
        path=self.folder/'photos.tar.gz'
        with tarfile.open(path,'w:gz') as tar:
            entry=tarfile.TarInfo(name);entry.type=kind;entry.size=len(content) if kind==tarfile.REGTYPE else 0
            if kind in (tarfile.SYMTYPE,tarfile.LNKTYPE):entry.linkname='/etc/passwd'
            tar.addfile(entry,io.BytesIO(content) if entry.size else None)
        return path

    def test_checksums_require_all_private_members_and_match_bytes(self):
        self.manifest();self.assertEqual(set(v.checksum_manifest(self.folder)),v.FILES)
        (self.folder/'store.dump').write_bytes(b'corrupt')
        with self.assertRaises(ValueError):v.checksum_manifest(self.folder)

    def test_public_files_symlinks_and_manifest_paths_are_rejected(self):
        self.manifest();(self.folder/'app.env').chmod(0o644)
        with self.assertRaises(ValueError):v.checksum_manifest(self.folder)
        self.manifest();(self.folder/'app.env').unlink();(self.folder/'app.env').symlink_to(self.folder/'migrate.env')
        with self.assertRaises(ValueError):v.checksum_manifest(self.folder)
        self.manifest_rewrite='0'*64+'  ../store.dump\n'
        (self.folder/'SHA256SUMS').write_text(self.manifest_rewrite)
        with self.assertRaises(ValueError):v.checksum_manifest(self.folder)

    def test_photo_bytes_must_match_immutable_name_without_extracting(self):
        data=b'RIFF'+b'\x00'*4+b'WEBP'+b'fixture';digest=hashlib.sha256(data).hexdigest()
        p=self.archive('uploads/'+digest+'.webp',data)
        self.assertEqual(v.verify_uploads(p),{'photos':1,'photoBytes':len(data)})
        with self.assertRaises(ValueError):v.verify_uploads(self.archive('uploads/'+'0'*64+'.webp',data))
        self.assertFalse((self.folder/'uploads').exists())

    def test_links_and_archive_traversal_are_rejected(self):
        for name,kind in [('../escape',tarfile.REGTYPE),('/etc/passwd',tarfile.REGTYPE),('uploads/'+'a'*64+'.webp',tarfile.SYMTYPE),('uploads/'+'b'*64+'.webp',tarfile.LNKTYPE)]:
            with self.subTest(name=name,kind=kind),self.assertRaises(ValueError):v.verify_uploads(self.archive(name,b'fixture',kind))

    def test_postgres_uses_only_local_peer_auth_and_never_inherits_app_settings(self):
        from types import SimpleNamespace
        with patch.dict(os.environ, {"PGHOST": "remote.invalid", "PGDATABASE": "live", "DATABASE_URL": "private-value"}), patch.object(v.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'{}')) as run:
            v.pg('psql', ['--dbname=imad_restore_'+'a'*32])
        command=run.call_args.args[0];environment=run.call_args.kwargs['env']
        self.assertIn('--host=/var/run/postgresql',command)
        self.assertIn('--port=5432',command)
        self.assertEqual(set(environment),{'PATH','LANG'})
        self.assertNotIn('live',' '.join(command))

    def test_failed_creation_never_drops_an_existing_database(self):
        with patch.object(v,'pg',side_effect=RuntimeError('create failed')) as pg:
            with self.assertRaises(RuntimeError):v.restore_probe(self.folder/'unused')
        self.assertEqual([c.args[0] for c in pg.call_args_list],['createdb'])

    def test_failed_restore_removes_only_its_own_random_database(self):
        p=self.folder/'store.dump';p.write_bytes(b'fake')
        with patch.object(v,'pg',side_effect=['',RuntimeError('restore failed'),'']) as pg:
            with self.assertRaises(RuntimeError):v.restore_probe(p)
        calls=pg.call_args_list;self.assertEqual([c.args[0] for c in calls],['createdb','pg_restore','dropdb'])
        name=calls[0].args[1][-1];self.assertRegex(name,v.RESTORE_NAME)
        self.assertEqual(calls[-1].args[1][-1],name)

if __name__=='__main__':unittest.main()
