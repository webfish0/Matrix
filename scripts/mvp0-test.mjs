import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readJson, assert, writeJson } from './lib.mjs';

const results = [];

async function test(id, name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    results.push({ id, name, status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    results.push({ id, name, status: 'failed', durationMs: Date.now() - startedAt, message: error.message });
  }
}

await test('T-001', 'client and agent artifacts share pinned Code OSS baseline', async () => {
  const upstream = await readJson('smith/baseline/upstream.json');
  const product = await readJson('smith/product.json');
  const inventory = await readJson('smith/inventory/module-inventory.json');
  const client = await readJson('artifacts/dev/smith-client-dev.json');
  const agent = await readJson('artifacts/dev/smith-agent-dev.json');
  const manifest = await readJson('artifacts/dev/manifest.json');

  assert(/^[0-9a-f]{40}$/.test(upstream.upstream.commit), 'upstream commit must be a 40-character SHA');
  assert(upstream.upstream.repository === 'https://github.com/microsoft/vscode.git', 'upstream repository must be Code OSS');
  assert(client.upstream.commit === upstream.upstream.commit, 'client artifact must record pinned upstream commit');
  assert(agent.upstream.commit === upstream.upstream.commit, 'agent artifact must record pinned upstream commit');
  assert(client.upstream.commit === agent.upstream.commit, 'client and agent must use the same upstream commit');
  assert(client.product.version === product.version, 'client artifact must record Smith version');
  assert(agent.product.version === product.version, 'agent artifact must record Smith version');
  assert(inventory.upstreamCommit === upstream.upstream.commit, 'module inventory must match pinned upstream commit');
  assert(manifest.artifacts.length === 2, 'artifact manifest must list client and agent artifacts');
});

await test('T-026', 'licence and branding policy excludes prohibited default dependencies', async () => {
  const product = await readJson('smith/product.json');
  const policy = await readFile('smith/policies/licensing.md', 'utf8');
  const client = await readJson('artifacts/dev/smith-client-dev.json');
  const agent = await readJson('artifacts/dev/smith-agent-dev.json');

  assert(product.branding.usesMicrosoftVisualStudioCodeBranding === false, 'product must not use Microsoft VS Code branding');
  assert(product.branding.usesMicrosoftMarketplaceByDefault === false, 'product must not use Microsoft Marketplace by default');
  assert(product.branding.usesMicrosoftPackagedVSCodeServer === false, 'product must not use Microsoft packaged VS Code Server');
  assert(client.distribution.serverLicenceDependency === 'none', 'client artifact must not depend on Microsoft server licence');
  assert(agent.distribution.serverLicenceDependency === 'none', 'agent artifact must not depend on Microsoft server licence');
  assert(policy.includes('Microsoft-packaged VS Code Server'), 'policy must name prohibited Microsoft packaged server dependency');
});

await test('T-027-smoke', 'upstream update workflow controls are recorded', async () => {
  const upstream = await readJson('smith/baseline/upstream.json');
  const inventory = await readJson('smith/inventory/module-inventory.json');
  assert(upstream.updatePolicy.cadence.includes('monthly'), 'update cadence must be recorded');
  assert(upstream.updatePolicy.routineBudget.includes('five engineer-days'), 'routine update budget must be recorded');
  assert(upstream.updatePolicy.patchInventory === 'smith/inventory/module-inventory.json', 'patch inventory path must be recorded');
  assert(inventory.groups.length >= 6, 'module inventory must classify the major Code OSS areas');
  assert(inventory.groups.every((group) => group.owner && group.tests.length > 0), 'each inventory group must have owner and tests');
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/mvp-0-foundation/junit', { recursive: true });
await writeJson('test-evidence/mvp-0-foundation/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'mvp-0-foundation',
  results
});
await writeFile(
  'test-evidence/mvp-0-foundation/junit/mvp0.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="mvp-0-foundation" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.mvp0" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
    }),
    '</testsuite>',
    ''
  ].join('\n'),
  'utf8'
);

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.id} ${result.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
