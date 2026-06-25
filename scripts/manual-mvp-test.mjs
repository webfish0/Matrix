import { Writable } from 'node:stream';
import { IdeSession } from '../src/ide/session.mjs';
import { SshWorkspaceClient, workspaceFile } from '../src/remote/ssh-workspace.mjs';
import { withSshFixture } from './ssh-fixture.mjs';
import { writeJson } from './lib.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const results = [];

class CaptureStream extends Writable {
  constructor() {
    super();
    this.text = '';
  }

  _write(chunk, _encoding, callback) {
    this.text += chunk.toString();
    callback();
  }
}

async function test(id, name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    results.push({ id, name, status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    results.push({ id, name, status: 'failed', durationMs: Date.now() - startedAt, message: error.message });
  }
}

await test('MANUAL-MVP-001', 'interactive IDE commands browse edit save search run and quit', async () => {
  await withSshFixture(async ({ target, workspace }) => {
    const output = new CaptureStream();
    const client = new SshWorkspaceClient(target);
    const session = new IdeSession({ client, workspace, remoteLabel: 'ssh:fixture', outputWriter: output });
    await session.initialize();
    await session.runScript([
      'ls',
      'open src/app.ts',
      'replace hello manual-mvp',
      'save',
      'search manual-mvp',
      'run /bin/echo ide-ok',
      'status',
      'quit'
    ]);
    const saved = await client.readFile(workspaceFile(workspace, 'src/app.ts'));
    assert(saved.includes('manual-mvp'), 'manual edit must be saved remotely');
    const transcript = output.text;
    assert(transcript.includes('Smith Product MVP interactive IDE'), 'transcript must show interactive IDE banner');
    assert(transcript.includes('Explorer'), 'transcript must show explorer');
    assert(transcript.includes('Saved src/app.ts'), 'transcript must show save');
    assert(transcript.includes('src/app.ts:1'), 'transcript must show search result');
    assert(transcript.includes('ide-ok'), 'transcript must show remote terminal command output');
    await mkdir('test-evidence/manual-product-mvp', { recursive: true });
    await writeFile('test-evidence/manual-product-mvp/transcript.txt', transcript, 'utf8');
  });
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/manual-product-mvp/junit', { recursive: true });
await writeJson('test-evidence/manual-product-mvp/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'manual-product-mvp',
  results
});
await writeFile(
  'test-evidence/manual-product-mvp/junit/manual-product-mvp.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="manual-product-mvp" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.manual-product-mvp" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
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
  if (!condition) {
    throw new Error(message);
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
