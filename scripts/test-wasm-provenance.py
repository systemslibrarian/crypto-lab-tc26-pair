"""Offline positive/negative controls for provenance evidence, not crypto tests."""
import hashlib
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('provenance', ROOT / 'scripts/check-wasm-provenance.py')
provenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provenance)


class ProvenanceControls(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='tc26-controls-')
        self.addCleanup(self.scratch.cleanup)
        self.root = pathlib.Path(self.scratch.name)
        self.manifest_path = self.root / 'src/wasm/provenance.json'
        self.manifest_path.parent.mkdir(parents=True)
        (self.root / 'scripts').mkdir()
        (self.root / 'native').mkdir()
        self.manifest = {'scope': 'two WASM files only', 'originalCompiler': None,
                         'testCompiler': {'version': 'fixture'}, 'artifacts': []}
        for name, (source, commit) in provenance.EXPECTED.items():
            payload = (name + '-wasm').encode()
            (self.root / ('src/wasm/' + name + '.wasm')).write_bytes(payload)
            (self.root / ('src/wasm/' + name + '.js')).write_text(name + '-adapter')
            (self.root / ('native/' + name + '_wrapper.c')).write_text('/* fixture wrapper */')
            script = self.root / ('scripts/build-' + name + '-wasm.sh')
            script.write_text(
                'set -eu\n'
                'test -n "$WASM_OUTPUT_DIR"\n'
                'test ! -e "$WASM_OUTPUT_DIR/' + name + '.wasm"\n'
                'test ! -e "$EM_CACHE"\n'
                'printf %s ' + name + '-wasm > "$WASM_OUTPUT_DIR/' + name + '.wasm"\n'
                'printf %s ' + name + '-adapter > "$WASM_OUTPUT_DIR/' + name + '.js"\n')
            self.manifest['artifacts'].append({
                'path': 'src/wasm/' + name + '.wasm',
                'sha256': hashlib.sha256(payload).hexdigest(), 'source': source,
                'commit': commit, 'build': 'scripts/build-' + name + '-wasm.sh'})
        self.write_manifest()
        for command in (
                ['git', 'init', '-q'],
                ['git', 'add', 'src', 'scripts', 'native'],
                ['git', '-c', 'user.name=Fixture', '-c',
                 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']):
            subprocess.run(command, cwd=self.root, check=True, capture_output=True)

    def write_manifest(self):
        self.manifest_path.write_text(json.dumps(self.manifest))

    def collect(self, rebuild=False, timeout=1):
        # Tool inspection is not compiler execution and is outside these offline
        # evidence controls; real compiler identities are captured by --rebuild.
        with patch.object(provenance, 'tool_evidence', return_value={'state': 'fixture'}):
            return provenance.collect(self.root, rebuild, self.root / 'reports', timeout)

    def replace_build(self, name, text):
        (self.root / ('scripts/build-' + name + '-wasm.sh')).write_text(text)

    def test_complete_fingerprint_is_not_rebuild_or_original_compiler_evidence(self):
        report, code = self.collect()
        self.assertEqual(code, 0)
        self.assertEqual(report['checkedCount'], 2)
        self.assertEqual(report['attemptedCount'], 0)
        self.assertEqual(report['state'], 'fingerprint-verified-rebuild-unverified')
        self.assertIsNone(report['actualBuildEnvironment'])
        self.assertIsNone(report['originalCompiler'])

    def test_compiler_relative_tool_paths_are_read_without_executing_configuration(self):
        config = self.root / '.emscripten'
        marker = self.root / 'must-not-execute'
        config.write_text("LLVM_ROOT = 'sdk/bin'\nBINARYEN_ROOT = 'sdk'\n"
                          "NODE_JS = 'node/bin/node'\n"
                          "open(" + repr(str(marker)) + ", 'w').write('bad')\n")
        with patch.dict(os.environ, {'EM_CONFIG': str(config)}), patch.object(
                provenance, 'tool_evidence', side_effect=lambda p: {'path': p}):
            report = provenance.compiler_configuration()
        self.assertEqual(report['selectedTools']['clang']['path'],
                         str(self.root / 'sdk/bin/clang'))
        self.assertEqual(report['selectedTools']['compilerNode']['path'],
                         str(self.root / 'node/bin/node'))
        self.assertFalse(marker.exists())

    def test_both_fresh_outputs_match_and_tracked_files_are_unchanged(self):
        before = {p: p.read_bytes() for p in (self.root / 'src/wasm').iterdir()}
        report, code = self.collect(True)
        self.assertEqual(code, 0)
        self.assertEqual(report['checkedCount'], 2)
        self.assertEqual(report['attemptedCount'], 2)
        self.assertTrue(report['trackedEvidenceUnchanged'])
        self.assertTrue(all(a['adapterMatches'] for a in report['artifacts']))
        self.assertEqual(before, {p: p.read_bytes() for p in before})

    def test_symlinked_temporary_root_uses_canonical_compiler_cache(self):
        real = self.root / 'real-temp'
        real.mkdir()
        alias = self.root / 'temp-alias'
        alias.symlink_to(real, target_is_directory=True)
        for name in provenance.EXPECTED:
            path = self.root / ('scripts/build-' + name + '-wasm.sh')
            path.write_text('case "$EM_CACHE" in "' + str(real.resolve()) +
                            '/"*) ;; *) exit 9 ;; esac\n' + path.read_text())
        with patch.object(provenance.tempfile, 'tempdir', str(alias)):
            self.assertEqual(self.collect(True)[1], 0)

    def test_empty_omitted_duplicate_and_unexpected_inventory_are_unreadable(self):
        valid = list(self.manifest['artifacts'])
        for artifacts in ([], valid[:1], [valid[0], valid[0]],
                          [valid[0], {**valid[1], 'path': '../foreign.wasm'}]):
            with self.subTest(artifacts=artifacts):
                self.manifest['artifacts'] = artifacts
                self.write_manifest()
                report, code = self.collect()
                self.assertEqual(code, 2)
                self.assertEqual(report['checkedCount'], 0)

    def test_wrong_source_commit_build_and_malformed_digest_are_unreadable(self):
        row = dict(self.manifest['artifacts'][0])
        for field, value in [('source', 'https://example.invalid/other'),
                             ('commit', 'a' * 40), ('build', '../other.sh'),
                             ('sha256', 'malformed')]:
            with self.subTest(field=field):
                self.manifest['artifacts'][0] = {**row, field: value}
                self.write_manifest()
                self.assertEqual(self.collect()[1], 2)

    def test_malformed_or_missing_manifest_is_unreadable(self):
        self.manifest_path.write_text('{not-json')
        self.assertEqual(self.collect()[1], 2)
        self.manifest_path.unlink()
        self.assertEqual(self.collect()[1], 2)

    def test_missing_or_symlinked_binary_is_unreadable(self):
        target = self.root / 'src/wasm/hypericum.wasm'
        payload = target.read_bytes()
        target.unlink()
        self.assertEqual(self.collect()[1], 2)
        other = self.root / 'other.wasm'
        other.write_bytes(payload)
        target.symlink_to(other)
        self.assertEqual(self.collect()[1], 2)

    def test_tampered_shipped_bytes_are_observed_mismatch(self):
        (self.root / 'src/wasm/hypericum.wasm').write_bytes(b'tampered')
        report, code = self.collect()
        self.assertEqual(code, 1)
        self.assertEqual(report['artifacts'][0]['state'], 'fingerprint-mismatch')

    def test_build_success_without_output_cannot_reuse_existing_binary(self):
        self.replace_build('hypericum', 'exit 0\n')
        report, code = self.collect(True)
        self.assertEqual(code, 2)
        self.assertEqual(report['artifacts'][0]['state'], 'build-unreadable')
        self.assertEqual(report['checkedCount'], 1)

    def test_partial_collection_and_missing_adapter_remain_incomplete(self):
        self.replace_build('shipovnik',
                           'printf %s shipovnik-wasm > "$WASM_OUTPUT_DIR/shipovnik.wasm"\n')
        report, code = self.collect(True)
        self.assertEqual(code, 2)
        self.assertEqual(report['checkedCount'], 1)
        self.assertEqual(report['state'], 'incomplete')

    def test_fresh_byte_mismatch_is_not_unreadable(self):
        self.replace_build('hypericum',
                           'printf %s wrong > "$WASM_OUTPUT_DIR/hypericum.wasm"\n'
                           'printf %s adapter > "$WASM_OUTPUT_DIR/hypericum.js"\n')
        report, code = self.collect(True)
        self.assertEqual(code, 1)
        self.assertEqual(report['artifacts'][0]['state'], 'byte-mismatch')

    def test_build_failure_is_not_a_missing_check(self):
        self.replace_build('hypericum', 'exit 7\n')
        report, code = self.collect(True)
        self.assertEqual(code, 1)
        self.assertEqual(report['artifacts'][0]['buildExit'], 7)
        self.assertEqual(report['artifacts'][0]['state'], 'build-failed')

    def test_timeout_stays_unreadable_and_stops_child(self):
        pid_file = self.root / 'child.pid'
        self.replace_build('hypericum',
                           'sleep 30 &\nchild=$!\nprintf %s "$child" > "' +
                           str(pid_file) + '"\nwait "$child"\n')
        started = time.monotonic()
        report, code = self.collect(True, timeout=.1)
        self.assertEqual(code, 2)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(report['artifacts'][0]['state'], 'build-unreadable')
        pid = int(pid_file.read_text())
        result = subprocess.run(['ps', '-p', str(pid), '-o', 'stat='],
                                capture_output=True, text=True)
        self.assertTrue(result.returncode != 0 or result.stdout.strip().startswith('Z'))

    def test_source_change_during_build_invalidates_evidence(self):
        self.replace_build('shipovnik',
                           'printf %s shipovnik-wasm > "$WASM_OUTPUT_DIR/shipovnik.wasm"\n'
                           'printf %s shipovnik-adapter > "$WASM_OUTPUT_DIR/shipovnik.js"\n'
                           'printf %s changed >> native/shipovnik_wrapper.c\n')
        report, code = self.collect(True)
        self.assertEqual(code, 2)
        self.assertEqual(report['state'], 'source-changed')
        self.assertFalse(report['trackedEvidenceUnchanged'])

    def test_head_change_during_build_invalidates_evidence(self):
        path = self.root / 'scripts/build-shipovnik-wasm.sh'
        path.write_text(path.read_text() +
                        'printf %s changed > new-tracked-file\n'
                        'git add new-tracked-file\n'
                        'git -c user.name=Fixture -c user.email=fixture@example.invalid '
                        'commit -qm changed-head\n')
        report, code = self.collect(True)
        self.assertEqual(code, 2)
        self.assertEqual(report['state'], 'source-changed')
        self.assertNotEqual(report['sourceSha'], report['endingSourceSha'])


if __name__ == '__main__':
    unittest.main()
