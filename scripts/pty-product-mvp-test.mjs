import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { writeJson } from './lib.mjs';

const execFileAsync = promisify(execFile);
const startedAt = Date.now();
let result;

try {
  const { stdout, stderr } = await execFileAsync('python3', ['scripts/pty-user-journey.py'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 20 * 1024 * 1024
  });
  const harness = JSON.parse(await readFile('test-evidence/pty-product-mvp/harness-result.json', 'utf8'));
  assert(harness.status === 'passed', harness.message ?? 'PTY harness did not pass');
  result = {
    id: 'USER-PTY-001',
    name: 'user controls the real Smith CLI through an operating-system PTY',
    level: 'black-box-pty',
    status: 'passed',
    durationMs: Date.now() - startedAt,
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
    ],
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
} catch (error) {
  result = {
    id: 'USER-PTY-001',
    name: 'user controls the real Smith CLI through an operating-system PTY',
    level: 'black-box-pty',
    status: 'failed',
    durationMs: Date.now() - startedAt,
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
    ],
    message: error.stderr?.trim() || error.message
  };
}

await mkdir('test-evidence/pty-product-mvp/junit', { recursive: true });
await writeJson('test-evidence/pty-product-mvp/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'pty-product-mvp',
  testLevel: 'black-box-pty',
  results: [result]
});
await writeFile(
  'test-evidence/pty-product-mvp/junit/pty-product-mvp.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="pty-product-mvp" tests="1" failures="${result.status === 'passed' ? 0 : 1}">`,
    `  <testcase classname="smith.pty-product-mvp" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : ''}</testcase>`,
    '</testsuite>',
    ''
  ].join('\n'),
  'utf8'
);

console.log(`${result.status.toUpperCase()} ${result.id} ${result.name}`);
if (result.status !== 'passed') {
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
