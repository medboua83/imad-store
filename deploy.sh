# Publication IMAD Mode PR 110 depuis la console HTML5 de Namecheap.
# Ouvrez une session root sur le VPS, puis collez le bloc entier.
# Sauvegarde verifiee, telechargement HTTPS depuis GitHub, migration et controle du site.
python3 - "$@" <<'IMAD_COLOR_CONSOLE'
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile
from urllib.request import urlopen

COMMIT = '78ec5cfb787277470617fd9d50c24e2bfe01a3c3'
BASELINE = '74a3f1ffb5a77f9e853e47aacd0e58202d1444ea'
SOURCE_FILES_SHA = '0dc673b4634b2366071b07bec049f440d93927f26dad7b3dd07bd74cbb072d86'
BASELINE_FILES_SHA = '3437ded83a99c103a6029d482c36ef8afa67c828b08c36f535193b77e68494fa'
DEPLOY_SCRIPT = (
    '"""Publish an immutable tested archive; keep database, secrets and uploads unchanged."""\n'
    'import hashlib, json, re, os, pathlib, subprocess, tarfile, time, urllib.request\n'
    '\n'
    "work = pathlib.Path('/root/imad-color-photos-20261110')\n"
    "manifest = json.loads((work / 'RELEASE_MANIFEST.json').read_text())\n"
    'assert os.geteuid() == 0\n'
    "commit = manifest['commit']\n"
    "assert len(commit) == 40 and all(c in '0123456789abcdef' for c in commit)\n"
    "archive = work / 'source.tar.gz'\n"
    "assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['archive_sha256']\n"
    "current = pathlib.Path('/srv/imadmode/current')\n"
    'previous = current.resolve(strict=True)\n'
    "assert previous.is_relative_to('/srv/imadmode/releases')\n"
    '\n'
    'def verify_source(directory, files):\n'
    '    for name, expected in files.items():\n'
    '        path = directory / name\n'
    '        assert path.is_relative_to(directory) and not path.is_symlink(), name\n'
    "        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'Source changed: ' + name\n"
    '\n'
    "assert (previous / '.imad-source-revision').read_text().strip() == manifest['baseline_commit']\n"
    "verify_source(previous, manifest['baseline_files'])\n"
    "backup_root = pathlib.Path('/srv/imadmode/shared/backups')\n"
    'backups_before = set(backup_root.iterdir())\n'
    "subprocess.run(['/usr/local/sbin/imadmode-backup'], check=True)\n"
    'created_backups = set(backup_root.iterdir()) - backups_before\n'
    "assert len(created_backups) == 1, 'Review concurrent backup creation before publication'\n"
    'backup_directory = created_backups.pop()\n'
    "release = pathlib.Path('/srv/imadmode/releases') / ('color-photos-' + commit[:12])\n"
    "assert not release.exists(), 'Never overwrite a release'\n"
    'release.mkdir(mode=0o755)\n'
    'with tarfile.open(archive) as stream:\n'
    "    stream.extractall(release, filter='data')\n"
    "verify_source(release, manifest['source_files'])\n"
    "for directory in ['node_modules', 'apps/web/node_modules', 'backend/node_modules']:\n"
    '    source, target = previous / directory, release / directory\n'
    '    if source.exists():\n'
    '        assert not target.exists(), directory\n'
    '        target.parent.mkdir(parents=True, exist_ok=True)\n'
    "        subprocess.run(['cp', '-a', str(source), str(target)], check=True)\n"
    "subprocess.run(['chown', '-R', 'imadmode:imadmode', str(release)], check=True)\n"
    "log = work / 'WEB_BUILD.txt'\n"
    "env = {'NODE_ENV': 'production', 'IMAD_HOSTING_MODE': 'combined',\n"
    "       'NEXT_PUBLIC_API_URL': '/api', 'SITE_URL': 'https://imadmode.com',\n"
    "       'NEXT_TELEMETRY_DISABLED': '1', 'PATH': '/usr/local/bin:/usr/bin:/bin'}\n"
    "with log.open('wb') as output:\n"
    "    build = subprocess.run(['runuser', '-u', 'imadmode', '--', 'env',\n"
    "        *[key + '=' + value for key, value in env.items()],\n"
    "        'sh', '-c', 'npm --prefix packages/shared run build && npm --prefix backend run prisma:generate && npm --prefix backend run build && npm --prefix apps/web run build'], cwd=release, stdout=output, stderr=subprocess.STDOUT)\n"
    'log.chmod(0o600)\n'
    "subprocess.run(['chown', '-R', 'root:imadmode', str(release)], check=True)\n"
    "subprocess.run(['chmod', '-R', 'g-w,o-w', str(release)], check=True)\n"
    "assert build.returncode == 0, 'Build failed; old service retained. See private build log.'\n"
    'assert subprocess.check_output(["node", "-e", \'process.stdout.write(String(require("./packages/shared/dist").MAX_PRODUCT_PHOTOS))\'], cwd=release, text=True).strip() == "25"\n'
    "verify_source(release, manifest['source_files'])\n"
    "cache = release / 'apps/web/.next/cache'\n"
    'cache.mkdir(parents=True, exist_ok=True)\n'
    "subprocess.run(['chown', '-R', 'imadmode:imadmode', str(cache)], check=True)\n"
    "(release / '.imad-source-revision').write_text(commit + '\\n')\n"
    '\n'
    'def point_to(target):\n'
    "    temporary = current.with_name('current-color-photos-candidate')\n"
    '    assert not temporary.exists() and not temporary.is_symlink()\n'
    '    temporary.symlink_to(target)\n'
    '    os.replace(temporary, current)\n'
    '\n'
    'def ready():\n'
    '    for attempt in range(25):\n'
    '        try:\n'
    "            with urllib.request.urlopen('http://127.0.0.1:3138/health', timeout=3) as response:\n"
    '                assert response.status == 200\n'
    "            with urllib.request.urlopen('http://127.0.0.1:3138/api/products?limit=1', timeout=5) as response:\n"
    "                assert json.load(response)['success'] is True\n"
    '            return True\n'
    '        except Exception:\n'
    '            time.sleep(1)\n'
    '    return False\n'
    '\n'
    "state = {'commit': commit, 'previous_release': str(previous), 'release': str(release),\n"
    "         'backup_directory': str(backup_directory), 'database_migration': '20261109230000_product_color_photos', 'environment_unchanged': True, 'baseline_verified': True}\n"
    "(work / 'DEPLOYMENT_STATE.json').write_text(json.dumps(state, indent=2))\n"
    "subprocess.run(['/bin/sh', '-c',\n"
    "    'set -a; . /etc/imadmode/migrate.env; set +a; exec npm --prefix backend run prisma:migrate'],\n"
    '    cwd=release, check=True)\n'
    "schema_sql = '''SELECT count(*) FROM information_schema.columns\n"
    "    WHERE table_schema = 'public' AND table_name = 'products'\n"
    "      AND column_name = 'colorPhotos' AND is_nullable = 'YES' AND data_type = 'jsonb';'''\n"
    "assert subprocess.check_output(['runuser', '-u', 'postgres', '--', 'psql', '-XAt', '-d', 'imad_store', '-c', schema_sql],\n"
    "    text=True).strip() == '1', 'Expected optional color photo column missing'\n"
    'point_to(release)\n'
    'try:\n'
    "    subprocess.run(['systemctl', 'restart', 'imadmode'], check=True)\n"
    "    assert ready(), 'New service failed readiness'\n"
    "    origin = 'http://127.0.0.1:3138'\n"
    "    with urllib.request.urlopen(origin + '/shop?stats_test=1', timeout=12) as response:\n"
    '        html = response.read().decode()\n'
    '    previews = re.findall(r\'src="(/api/uploads/preview-v1/[a-f0-9]{64}\\.webp)"\', html)\n'
    "    assert previews, 'Catalogue is missing the expected lightweight photos'\n"
    '    with urllib.request.urlopen(origin + previews[0], timeout=12) as response:\n'
    "        assert response.status == 200 and response.headers.get_content_type() == 'image/webp'\n"
    '        header = response.read(12)\n'
    "        assert header[:4] == b'RIFF' and header[8:] == b'WEBP'\n"
    '    for section, slugs in [\n'
    "        ('women', {'abayas-d-hiver','manteau-femme','echarpe','cap-fourrier'}),\n"
    "        ('men', {'mens-clogs'}),\n"
    '    ]:\n'
    "        with urllib.request.urlopen(origin + '/api/products?section=' + section, timeout=12) as response:\n"
    '            scoped = json.load(response)\n'
    "        assert scoped['total'] > 0 and all(p['category']['slug'] in slugs for p in scoped['data'])\n"
    "        if section == 'men':\n"
    "            slug = scoped['data'][0]['slug']\n"
    "            with urllib.request.urlopen(origin + '/api/products/' + slug, timeout=12) as response:\n"
    "                item = json.load(response)['data']\n"
    "                assert 'colorPhotos' in item and item['images']\n"
    "    for path in ['/', '/admin', '/shop?section=women&stats_test=1', '/shop?section=men&stats_test=1']:\n"
    "        with urllib.request.urlopen('https://imadmode.com' + path, timeout=20) as response:\n"
    '            assert response.status == 200\n'
    'except Exception:\n'
    '    point_to(previous)\n'
    "    subprocess.run(['systemctl', 'restart', 'imadmode'], check=True)\n"
    "    state['rolled_back'] = True\n"
    "    state['rollback_ready'] = ready()\n"
    "    (work / 'DEPLOYMENT_STATE.json').write_text(json.dumps(state, indent=2))\n"
    '    raise\n'
    "state['ready'] = True\n"
    "(work / 'DEPLOYMENT_STATE.json').write_text(json.dumps(state, indent=2))\n"
    'print(json.dumps(state))\n'
)
SNAPSHOT_SCRIPT = (
    '"""Read-only preservation snapshot; never emit database rows or environment values."""\n'
    'import hashlib, json, pathlib, subprocess, sys\n'
    '\n'
    'assert len(sys.argv) == 2\n'
    'tables = ["products", "product_variants", "orders", "order_items", "categories",\n'
    '          "store_settings", "site_content", "store_installation", "deskcomm_connection",\n'
    '          "deskcomm_integrations", "olivraison_integration"]\n'
    'result = {"tables": {}, "files": {}}\n'
    'for table in tables:\n'
    '    # Identifiers come only from the fixed local list above.\n'
    '    row = "(to_jsonb(t) - \'colorPhotos\')" if table == "products" else "to_jsonb(t)"\n'
    '    query = \'SELECT \' + row + \'::text FROM "\' + table + \'" t ORDER BY \' + row + \'::text\'\n'
    '    rows = subprocess.run(["runuser", "-u", "postgres", "--", "psql", "-XAt", "-d", "imad_store", "-c", query],\n'
    '                          capture_output=True, check=True).stdout\n'
    '    result["tables"][table] = {"rows": len(rows.splitlines()), "sha256": hashlib.sha256(rows).hexdigest()}\n'
    'for filename in ["/etc/imadmode/app.env", "/etc/imadmode/migrate.env"]:\n'
    '    result["files"][filename] = hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest()\n'
    'uploads = pathlib.Path("/srv/imadmode/shared/uploads")\n'
    'result["uploads"] = {str(p.relative_to(uploads)): hashlib.sha256(p.read_bytes()).hexdigest()\n'
    '                     for p in sorted(uploads.rglob("*")) if p.is_file() and not p.is_symlink()}\n'
    'out = pathlib.Path(sys.argv[1])\n'
    'out.write_text(json.dumps(result, indent=2) + "\\n")\n'
    'out.chmod(0o600)\n'
    'print("Preservation snapshot saved: database digests, environment digests, original image hashes.")\n'
)
VERIFY_SCRIPT = (
    'import pathlib,json,hashlib,subprocess\n'
    "work=pathlib.Path('/root/imad-color-photos-20261110')\n"
    "manifest=json.loads((work/'RELEASE_MANIFEST.json').read_text())\n"
    "current=pathlib.Path('/srv/imadmode/current').resolve(strict=True)\n"
    "assert current==pathlib.Path('/srv/imadmode/releases') / ('color-photos-'+manifest['commit'][:12])\n"
    "revision=(current/'.imad-source-revision').read_text().strip()\n"
    "assert revision==manifest['commit']\n"
    "for name,expected in manifest['source_files'].items():\n"
    ' p=current/name\n'
    ' assert not p.is_symlink()\n'
    ' assert hashlib.sha256(p.read_bytes()).hexdigest()==expected,name\n'
    "assert subprocess.check_output(['systemctl','is-active','imadmode.service'],text=True).strip()=='active'\n"
    "subprocess.run(['python3',str(work/'VERIFY_PRESERVED_STATE.py'),str(work/'STATE_FINAL.json')],check=True)\n"
    "before=(work/'STATE_BEFORE.json').read_bytes()\n"
    "assert before==(work/'STATE_AFTER.json').read_bytes()==(work/'STATE_FINAL.json').read_bytes()\n"
    'query = \'SELECT count(*) FROM products WHERE "colorPhotos" IS NOT NULL\'\n'
    "assert subprocess.check_output(['runuser','-u','postgres','--','psql','-XAt','-d','imad_store','-c',query],text=True).strip()=='0'\n"
    "print(json.dumps({'service':'active','revision':revision,'release':str(current),'source_files_verified':len(manifest['source_files']),'business_data_preserved':True}))\n"
)

def source_archive(revision, expected):
    url = "https://codeload.github.com/medboua83/imad-store/tar.gz/" + revision
    with urlopen(url, timeout=40) as response:
        assert response.status == 200
        download = response.read(12 * 1024 * 1024 + 1)
    assert len(download) <= 12 * 1024 * 1024, "Archive unexpectedly large"
    files = {}
    archive = io.BytesIO()
    with tarfile.open(fileobj=io.BytesIO(download), mode="r:gz") as original:
        with tarfile.open(fileobj=archive, mode="w:gz") as packed:
            for member in original:
                path = PurePosixPath(member.name)
                assert not path.is_absolute() and ".." not in path.parts
                assert path.parts[0] == "imad-store-" + revision
                if member.isdir():
                    continue
                assert member.isfile() and len(path.parts) > 1
                name = str(PurePosixPath(*path.parts[1:]))
                assert name not in files and member.size <= 12 * 1024 * 1024
                with original.extractfile(member) as stream:
                    content = stream.read()
                files[name] = hashlib.sha256(content).hexdigest()
                item = tarfile.TarInfo(name)
                item.mode = member.mode & 0o777
                item.size = len(content)
                packed.addfile(item, io.BytesIO(content))
    signature = hashlib.sha256(json.dumps(files, sort_keys=True, separators=(",", ":")).encode())
    assert signature.hexdigest() == expected, "Archive does not match the tested source"
    return archive.getvalue(), files

if sys.argv[1:] == ["--verify-only"]:
    for revision, checksum in ((BASELINE, BASELINE_FILES_SHA), (COMMIT, SOURCE_FILES_SHA)):
        _, files = source_archive(revision, checksum)
        print(f"Archive verifiee {revision[:12]} ({len(files)} fichiers)")
    raise SystemExit(0)
assert not sys.argv[1:] and os.geteuid() == 0, "Utilisez la session root du VPS Namecheap"
assert Path("/srv/imadmode/current/.imad-source-revision").read_text().strip() == BASELINE, (
    "La version actuelle a change. Demandez un nouveau fichier avant de continuer."
)
subprocess.run(["systemctl", "is-active", "--quiet", "imadmode.service"], check=True)
assert Path("/etc/imadmode/migrate.env").is_file()
work = Path("/root/imad-color-photos-20261110")
assert not work.exists(), "Une tentative existe deja. Conservez les journaux et demandez une verification."
print("Telechargement HTTPS et verification des fichiers sources...", flush=True)
_, previous_files = source_archive(BASELINE, BASELINE_FILES_SHA)
archive, files = source_archive(COMMIT, SOURCE_FILES_SHA)

os.umask(0o077)
work.mkdir(mode=0o700)
(work / "source.tar.gz").write_bytes(archive)
(work / "RELEASE_MANIFEST.json").write_text(json.dumps({
    "commit": COMMIT,
    "archive_sha256": hashlib.sha256(archive).hexdigest(),
    "baseline_commit": BASELINE,
    "baseline_files": previous_files,
    "source_files": files,
}))
for filename, script in {
    "VERIFY_PRESERVED_STATE.py": SNAPSHOT_SCRIPT,
    "DEPLOY_TESTED_RELEASE.py": DEPLOY_SCRIPT,
    "VERIFY_DEPLOYED_SOURCE.py": VERIFY_SCRIPT,
}.items():
    (work / filename).write_text(script)
def run(filename, *args):
    subprocess.run([sys.executable, filename, *args], cwd=work, check=True, umask=0o022)
run("VERIFY_PRESERVED_STATE.py", "STATE_BEFORE.json")
run("DEPLOY_TESTED_RELEASE.py")
run("VERIFY_PRESERVED_STATE.py", "STATE_AFTER.json")
run("VERIFY_DEPLOYED_SOURCE.py")
print("IMAD MODE - PHOTOS PAR COULEUR PUBLIEES ET VERIFIEES")
IMAD_COLOR_CONSOLE
