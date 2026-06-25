import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildAgentInstallPlan } from '../src/remote/agent-plan.mjs';
import { evaluateHandshake } from '../src/remote/handshake.mjs';
import { parseSshG, resolveSshTarget } from '../src/remote/ssh-config.mjs';
import { validateSshHost } from '../src/remote/validation.mjs';
import { readJson, writeJson } from './lib.mjs';

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

await test('T-002', 'SSH target resolution uses OpenSSH without shell interpolation', async () => {
  const target = await resolveSshTarget({ host: 'localhost', workspace: '/tmp/smith workspace' });
  if (target.command.shell !== false) {
    throw new Error('SSH resolution must not use a shell.');
  }
  if (target.command.args[0] !== '-G' || target.command.args[1] !== 'localhost') {
    throw new Error('SSH resolution must pass host as an argv element.');
  }
  if (!target.resolved.hostname) {
    throw new Error('Resolved host must include a hostname.');
  }
  if (!Number.isInteger(target.resolved.port)) {
    throw new Error('Resolved host must include an integer port.');
  }
});

await test('T-002-security', 'SSH host validation rejects shell metacharacters', async () => {
  let rejected = false;
  try {
    validateSshHost('localhost;rm -rf /');
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error('Host validation must reject shell metacharacters.');
  }
});

await test('T-002-parser', 'OpenSSH -G parser handles repeated values', async () => {
  const parsed = parseSshG('hostname example.com\nuser smith\nidentityfile ~/.ssh/a\nidentityfile ~/.ssh/b\nport 2222\n');
  if (parsed.hostname !== 'example.com' || parsed.user !== 'smith' || parsed.port !== '2222') {
    throw new Error('Parser did not extract expected scalar values.');
  }
  if (!Array.isArray(parsed.identityfile) || parsed.identityfile.length !== 2) {
    throw new Error('Parser did not preserve repeated identityfile values.');
  }
});

await test('T-003', 'agent install plan and handshake require version-matched client and agent', async () => {
  const product = await readJson('smith/product.json');
  const upstream = await readJson('smith/baseline/upstream.json');
  const plan = buildAgentInstallPlan({ host: 'localhost', workspace: '/tmp/repo', product, upstream });
  if (!plan.installRoot.includes(product.version) || !plan.installRoot.includes(upstream.upstream.commit.slice(0, 12))) {
    throw new Error('Agent install path must include Smith version and upstream commit prefix.');
  }
  if (plan.lifecycle.installMode !== 'side-by-side') {
    throw new Error('Agent install must be side-by-side.');
  }
  const accepted = evaluateHandshake({
    client: { smithVersion: product.version, upstreamCommit: upstream.upstream.commit, protocolVersion: 'mvp-1' },
    agent: { smithVersion: product.version, upstreamCommit: upstream.upstream.commit, protocolVersion: 'mvp-1' }
  });
  if (!accepted.accepted) {
    throw new Error('Matching handshake should be accepted.');
  }
  const rejected = evaluateHandshake({
    client: { smithVersion: product.version, upstreamCommit: upstream.upstream.commit, protocolVersion: 'mvp-1' },
    agent: { smithVersion: product.version, upstreamCommit: '0000000000000000000000000000000000000000', protocolVersion: 'mvp-1' }
  });
  if (rejected.accepted || rejected.mismatches.length === 0) {
    throw new Error('Mismatched handshake should be rejected with reasons.');
  }
});

await test('T-005-startup-smoke', 'Smith connect-plan command exits successfully for localhost resolution', async () => {
  const output = execFileSync(process.execPath, ['scripts/smith.mjs', 'connect-plan', 'localhost', '/tmp/repo'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
  const parsed = JSON.parse(output);
  if (parsed.state !== 'ready-to-connect') {
    throw new Error('Connect plan should report ready-to-connect.');
  }
  if (parsed.sshTarget.command.shell !== false) {
    throw new Error('Connect plan must declare shell=false.');
  }
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/mvp-1-remote-spine/junit', { recursive: true });
await writeJson('test-evidence/mvp-1-remote-spine/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'mvp-1-remote-spine',
  results
});
await writeFile(
  'test-evidence/mvp-1-remote-spine/junit/mvp1.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="mvp-1-remote-spine" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.mvp1" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
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
