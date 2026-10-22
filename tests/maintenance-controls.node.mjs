import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const deployWorkflow = readFileSync(new URL('.github/workflows/deploy.yml', root), 'utf8');
const provenanceWorkflow = readFileSync(new URL('.github/workflows/wasm-provenance.yml', root), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

function job(workflow, name) {
  const match = workflow.match(new RegExp(`\\n  ${name}:\\n[\\s\\S]*?(?=\\n  [a-z][a-z0-9-]*:\\n|$)`));
  assert.ok(match, `missing ${name} job`);
  return match[0];
}

test('only the deploy job can mint Pages credentials', () => {
  const header = deployWorkflow.slice(0, deployWorkflow.indexOf('\njobs:'));
  assert.match(header, /permissions:\n  contents: read\n/);
  assert.doesNotMatch(header, /pages: write|id-token: write/);
  assert.doesNotMatch(job(deployWorkflow, 'build'), /pages: write|id-token: write/);
  assert.match(job(deployWorkflow, 'deploy'), /permissions:\n      pages: write\n      id-token: write\n/);
});

test('every third-party action in both workflows is pinned to an immutable commit', () => {
  const actions = [...`${deployWorkflow}\n${provenanceWorkflow}`.matchAll(
    /^\s*-\s+uses:\s+([^@\s]+)@([^\s]+)/gm,
  )];
  assert.ok(actions.length > 0, 'workflows have no actions');
  for (const [, action, reference] of actions) {
    assert.match(reference, /^[0-9a-f]{40}$/, `${action} is not commit-pinned`);
  }
});

test('pull requests do not configure Pages or package a deploy artifact', () => {
  assert.doesNotMatch(deployWorkflow, /actions\/configure-pages/);
  assert.match(
    job(deployWorkflow, 'build'),
    /uses: actions\/upload-pages-artifact@[0-9a-f]{40}[^\n]*\n\s+if: github\.event_name != 'pull_request'/,
  );
});

test('post-merge behavior is direct and fail-closed', () => {
  const autoMerge = job(deployWorkflow, 'dependabot-auto-merge');
  assert.doesNotMatch(autoMerge, /dependabot\/fetch-metadata/);
  assert.match(autoMerge, /exit 1/);
  assert.match(autoMerge, /gh workflow run deploy\.yml --repo "\$GITHUB_REPOSITORY" --ref main/);
  assert.doesNotMatch(autoMerge, /gh workflow run[^\n]*(?:\|\||continue-on-error)/);
});

test('a deployment carries and verifies exact source provenance', () => {
  assert.match(job(deployWorkflow, 'build'), /public\/deployment\.json/);
  assert.match(job(deployWorkflow, 'deploy'), /deployment\.json\?sha=\$\{GITHUB_SHA\}/);
  assert.match(job(deployWorkflow, 'deploy'), /p\.source_sha===process\.argv\[2\]/);
  assert.match(job(deployWorkflow, 'deploy'), /grep -Fq 'id="app"'/);
});

test('the provenance workflow retains its fail-closed evidence controls', () => {
  const rebuild = job(provenanceWorkflow, 'rebuild');
  assert.match(rebuild, /scripts\/test-wasm-provenance\.py -v/);
  assert.match(rebuild, /scripts\/check-wasm-provenance\.py --check/);
  assert.match(rebuild, /scripts\/check-wasm-provenance\.py --rebuild/);
  assert.match(rebuild, /a2b92777574c2feda07994cd4f1079a3dfc151f8/);
  assert.match(rebuild, /actions\/upload-artifact@[0-9a-f]{40}/);
});

test('the production build enforces these maintenance controls', () => {
  assert.equal(packageJson.scripts['test:maintenance'], 'node --test tests/maintenance-controls.node.mjs');
  assert.match(packageJson.scripts.build, /npm run test:maintenance/);
});
