import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { writeJson } from './lib.mjs';

const execFileAsync = promisify(execFile);
const results = [];
const specifications = [
  {
    id: 'USER-PTY-001',
    name: 'user controls the real Smith CLI through an operating-system PTY',
    args: [],
    resultPath: 'test-evidence/pty-product-mvp/harness-result.json',
    requirements: [
      'BR-001',
      'BR-004',
      'US-MVP-001',
      'US-MVP-002',
      'US-MVP-003',
      'US-MVP-004',
      'US-MVP-005',
      'US-MVP-006',
      'US-MVP-007',
      'US-MVP-008',
      'FR-005',
      'FR-007',
      'AC-003.2',
      'AC-003.3',
      'AC-004.1',
      'AC-004.2',
      'AC-008.4',
      'NFR-008'
    ]
  },
  ...[
    ['SIGHUP', 129],
    ['SIGINT', 130],
    ['SIGTERM', 143]
  ].map(([signal, exitCode]) => ({
    id: `T-005-${signal.toLowerCase()}`,
    name: `${signal} restores terminal modes and exits with status ${exitCode}`,
    args: ['signal', signal],
    resultPath: `test-evidence/pty-product-mvp/signal-${signal.toLowerCase()}-result.json`,
    requirements: ['FR-005', 'AC-008.4']
  }))
];

for (const specification of specifications) {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(
      'python3',
      ['scripts/pty-user-journey.py', ...specification.args],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 90_000,
        maxBuffer: 20 * 1024 * 1024
      }
    );
    const harness = JSON.parse(await readFile(specification.resultPath, 'utf8'));
    assert(harness.status === 'passed', harness.message ?? 'PTY harness did not pass');
    results.push({
      id: specification.id,
      name: specification.name,
      level: 'black-box-pty',
      status: 'passed',
      durationMs: Date.now() - startedAt,
      requirements: specification.requirements,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    });
  } catch (error) {
    results.push({
      id: specification.id,
      name: specification.name,
      level: 'black-box-pty',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      requirements: specification.requirements,
      message: error.stderr?.trim() || error.message
    });
  }
}

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/pty-product-mvp/junit', { recursive: true });
await writeJson('test-evidence/pty-product-mvp/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'pty-product-mvp',
  testLevel: 'black-box-pty',
  results
});
await writeFile(
  'test-evidence/pty-product-mvp/junit/pty-product-mvp.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="pty-product-mvp" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.pty-product-mvp" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
