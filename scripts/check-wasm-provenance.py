"""Check tracked fingerprints or attempt an explicitly pinned source rebuild.

A byte mismatch is an unreproduced artifact, not proof of incorrect cryptography.
Builds run only with --rebuild and never publish, commit or replace remote files.
"""
import argparse
import hashlib
import json
import pathlib
import platform
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'src/wasm/provenance.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
parser.add_argument('--rebuild', action='store_true')
args = parser.parse_args()
if args.check == args.rebuild:
    parser.error('choose exactly one of --check or --rebuild')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tool_evidence(command):
    """Record the tool actually found on PATH, not the manifest's CI selection."""
    executable = shutil.which(command)
    if executable is None:
        return {'state': 'unavailable'}
    resolved = pathlib.Path(executable).resolve()
    try:
        result = subprocess.run([executable, '--version'], capture_output=True,
                                text=True, timeout=30)
        return {'path': str(resolved), 'sha256': digest(resolved),
                'exit': result.returncode,
                'versionOutput': (result.stdout + result.stderr).strip()}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'path': str(resolved), 'state': 'unreadable', 'error': str(error)}

# --check only fingerprints existing artifacts; it has no observed build tool.
actual_environment = None
if args.rebuild:
    actual_environment = {
        'system': platform.platform(),
        'machine': platform.machine(),
        'tools': {name: tool_evidence(name) for name in ('emcc', 'emcmake', 'cmake')},
    }

rows = []
out = ROOT / 'provenance-results'
out.mkdir(exist_ok=True)
for artifact in manifest['artifacts']:
    target = ROOT / artifact['path']
    row = dict(artifact)
    row['trackedSha256'] = digest(target)
    row['fingerprintMatches'] = row['trackedSha256'] == artifact['sha256']
    if not row['fingerprintMatches']:
        row['state'] = 'fingerprint-mismatch'
    elif args.check:
        row['state'] = 'fingerprint-verified-rebuild-unverified'
    else:
        with (out / (target.stem + '.log')).open('w') as log:
            try:
                result = subprocess.run(['bash', artifact['build']], cwd=ROOT, stdout=log,
                                        stderr=subprocess.STDOUT, timeout=600)
                row['buildExit'] = result.returncode
                if result.returncode:
                    row['state'] = 'build-failed'
                else:
                    row['rebuiltSha256'] = digest(target)
                    row['state'] = ('byte-identical' if row['rebuiltSha256'] == artifact['sha256']
                                    else 'byte-mismatch')
            except (OSError, subprocess.TimeoutExpired) as error:
                row['state'] = 'build-unreadable'
                row['error'] = str(error)
    rows.append(row)
report = {
    'sourceSha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'originalCompiler': manifest['originalCompiler'],
    'selectedTestCompiler': manifest['testCompiler'],
    'actualBuildEnvironment': actual_environment,
    'scope': manifest['scope'],
    'artifacts': rows,
}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
ok = all(r['state'] == ('byte-identical' if args.rebuild else 'fingerprint-verified-rebuild-unverified') for r in rows)
sys.exit(0 if ok else 1)
