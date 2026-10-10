"""Check the complete tracked inventory or reproduce it in isolated output.

Exit 0: every required fingerprint/rebuild matches; 1: observed mismatch or
failed build; 2: missing, malformed, unreadable or incomplete evidence.
Fingerprint checks never establish source correspondence. Rebuilds never replace
the shipped files. Original compiler identity is independent of a test compiler.
"""
import argparse
import ast
import hashlib
import json
import os
import pathlib
import platform
import re
import shutil
import signal
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED = {
    'hypericum': ('https://github.com/QAPP-tech/hypericum_tc26',
                  'f3f254038e5539132d112e8f97332a2a351131fe'),
    'shipovnik': ('https://github.com/QAPP-tech/shipovnik_tc26',
                 'a9139ef6178a6dfebac3ae328817a361f0e85256'),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def readable_file(root, relative):
    path = root / relative
    if path.is_symlink() or not path.is_file():
        raise ValueError('Missing or non-regular evidence file: ' + relative)
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Evidence path escapes the repository: ' + relative)
    return path


def validate_manifest(root, manifest):
    artifacts = manifest.get('artifacts')
    if not isinstance(artifacts, list) or len(artifacts) != len(EXPECTED):
        raise ValueError('Inventory must contain both Hypericum and Shipovnik')
    expected_paths = {'src/wasm/' + name + '.wasm' for name in EXPECTED}
    if any(not isinstance(a, dict) for a in artifacts):
        raise ValueError('Each artifact must be an object')
    if {a.get('path') for a in artifacts} != expected_paths:
        raise ValueError('Incomplete, duplicate or unexpected artifact paths')
    for artifact in artifacts:
        name = pathlib.PurePosixPath(artifact['path']).stem
        source, commit = EXPECTED[name]
        if (artifact.get('source'), artifact.get('commit'), artifact.get('build')) != (
                source, commit, 'scripts/build-' + name + '-wasm.sh'):
            raise ValueError('Source/build identity differs for ' + name)
        if not isinstance(artifact.get('sha256'), str) or not re.fullmatch(
                r'[0-9a-f]{64}', artifact['sha256']):
            raise ValueError('Malformed SHA-256 for ' + name)
        readable_file(root, artifact['path'])
        readable_file(root, artifact['build'])
        readable_file(root, 'native/' + name + '_wrapper.c')
    if 'originalCompiler' not in manifest or not isinstance(manifest.get('testCompiler'), dict):
        raise ValueError('Original and selected compiler fields must remain distinct')


def tool_evidence(command):
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


def compiler_configuration():
    # Read literal configuration without executing Python from a config file.
    # PATH's node/clang can differ from the executables selected by emcc itself.
    configured = os.environ.get('EM_CONFIG')
    sdk = os.environ.get('EMSDK')
    path = pathlib.Path(configured) if configured else (
        pathlib.Path(sdk) / '.emscripten' if sdk else None)
    if path is None:
        return {'state': 'not-captured', 'reason': 'No explicit EM_CONFIG/EMSDK'}
    try:
        values = {}
        for node in ast.parse(path.read_text()).body:
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(
                    node.targets[0], ast.Name):
                try:
                    values[node.targets[0].id] = ast.literal_eval(node.value)
                except (ValueError, TypeError):
                    pass
        tools = {}
        for field, executable in [('LLVM_ROOT', 'clang'), ('LLVM_ROOT', 'wasm-ld'),
                                  ('BINARYEN_ROOT', 'bin/wasm-opt')]:
            if isinstance(values.get(field), str):
                tools[executable] = tool_evidence(str(pathlib.Path(values[field]) / executable))
        node = values.get('NODE_JS')
        if isinstance(node, (list, tuple)) and node and isinstance(node[0], str):
            tools['compilerNode'] = tool_evidence(node[0])
        return {'state': 'readable', 'path': str(path.resolve()),
                'sha256': digest(path), 'selectedTools': tools}
    except (OSError, SyntaxError) as error:
        return {'state': 'unreadable', 'path': str(path), 'error': str(error)}


def run_build(command, root, environment, log, timeout):
    # Stop the whole build process group on timeout, including compiler children.
    process = subprocess.Popen(command, cwd=root, env=environment, stdout=log,
                               stderr=subprocess.STDOUT, start_new_session=True)
    try:
        return process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        raise


def collect(root, rebuild, out, timeout=600):
    out.mkdir(parents=True, exist_ok=True)
    report = {'sourceSha': None, 'originalCompiler': None,
              'selectedTestCompiler': None, 'actualBuildEnvironment': None,
              'scope': 'Fingerprint identity is separate from source reproduction',
              'requiredCount': len(EXPECTED), 'attemptedCount': 0,
              'checkedCount': 0, 'artifacts': [], 'state': 'unreadable'}
    try:
        report['sourceSha'] = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
        if not re.fullmatch(r'[0-9a-f]{40}', report['sourceSha']):
            raise ValueError('Repository HEAD is unreadable')
        manifest_path = readable_file(root, 'src/wasm/provenance.json')
        manifest_bytes = manifest_path.read_bytes()
        manifest = json.loads(manifest_bytes)
        if not isinstance(manifest, dict):
            raise ValueError('Manifest must be an object')
        validate_manifest(root, manifest)
        report.update(originalCompiler=manifest['originalCompiler'],
                      selectedTestCompiler=manifest['testCompiler'],
                      manifestSha256=hashlib.sha256(manifest_bytes).hexdigest(),
                      scope=manifest.get('scope', report['scope']))
        if rebuild:
            report['actualBuildEnvironment'] = {
                'system': platform.platform(), 'machine': platform.machine(),
                'tools': {name: tool_evidence(name) for name in
                          ('emcc', 'emcmake', 'cmake', 'node')},
                'compilerConfiguration': compiler_configuration(),
                'cache': 'new empty cache per artifact',
            }
        observed_paths = {'src/wasm/provenance.json'}
        for artifact in manifest['artifacts']:
            stem = pathlib.PurePosixPath(artifact['path']).stem
            observed_paths.update((artifact['path'], artifact['build'],
                                   'native/' + stem + '_wrapper.c',
                                   'src/wasm/' + stem + '.js'))
        before = {p: digest(readable_file(root, p)) for p in observed_paths}
        for artifact in manifest['artifacts']:
            row = dict(artifact)
            stem = pathlib.PurePosixPath(artifact['path']).stem
            row.update(trackedSha256=before[artifact['path']],
                       buildScriptSha256=before[artifact['build']],
                       wrapperSha256=before['native/' + stem + '_wrapper.c'])
            row['fingerprintMatches'] = row['trackedSha256'] == artifact['sha256']
            if not row['fingerprintMatches']:
                row['state'] = 'fingerprint-mismatch'
            elif not rebuild:
                row['state'] = 'fingerprint-verified-rebuild-unverified'
                report['checkedCount'] += 1
            else:
                report['attemptedCount'] += 1
                with tempfile.TemporaryDirectory(prefix='tc26-provenance-') as td:
                    # macOS /var -> /private/var aliases otherwise disagree with
                    # the SDK's relative paths while generating system libraries.
                    scratch = pathlib.Path(td).resolve()
                    output = scratch / 'output'
                    output.mkdir()
                    environment = dict(os.environ, WASM_OUTPUT_DIR=str(output),
                                       EM_CACHE=str(scratch / 'compiler-cache'),
                                       CCACHE_DISABLE='1')
                    with (out / (stem + '.log')).open('w') as log:
                        try:
                            row['buildExit'] = run_build(
                                ['bash', artifact['build']], root, environment, log, timeout)
                            if row['buildExit']:
                                row['state'] = 'build-failed'
                            else:
                                rebuilt = readable_file(output, stem + '.wasm')
                                adapter = readable_file(output, stem + '.js')
                                row['rebuiltSha256'] = digest(rebuilt)
                                row['rebuiltAdapterSha256'] = digest(adapter)
                                row['trackedAdapterSha256'] = before['src/wasm/' + stem + '.js']
                                row['adapterMatches'] = (row['rebuiltAdapterSha256'] ==
                                                         row['trackedAdapterSha256'])
                                report['checkedCount'] += 1
                                row['state'] = ('byte-identical' if row['rebuiltSha256'] ==
                                                artifact['sha256'] else 'byte-mismatch')
                        except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                            row['state'] = 'build-unreadable'
                            row['error'] = str(error)
            report['artifacts'].append(row)
        after = {p: digest(readable_file(root, p)) for p in observed_paths}
        report['endingSourceSha'] = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
        report['trackedEvidenceUnchanged'] = (
            before == after and report['endingSourceSha'] == report['sourceSha'])
        if not report['trackedEvidenceUnchanged']:
            report['state'] = 'source-changed'
            return report, 2
        expected_state = ('byte-identical' if rebuild else
                          'fingerprint-verified-rebuild-unverified')
        if report['checkedCount'] == len(EXPECTED) and all(
                a['state'] == expected_state for a in report['artifacts']):
            report['state'] = expected_state
            return report, 0
        unread = any(a['state'] == 'build-unreadable' for a in report['artifacts'])
        report['state'] = 'incomplete' if unread else 'mismatch-or-build-failed'
        return report, 2 if unread else 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        report['error'] = str(error)
        return report, 2


def main(argv=None, root=ROOT):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--rebuild', action='store_true')
    parser.add_argument('--output', type=pathlib.Path, default=root / 'provenance-results')
    parser.add_argument('--timeout', type=float, default=600)
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error('--timeout must be positive')
    report, code = collect(root, args.rebuild, args.output, args.timeout)
    (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return code


if __name__ == '__main__':
    sys.exit(main())
