import { Writable } from 'node:stream';
import { mkdir, writeFile } from 'node:fs/promises';
import { IdeSession } from '../src/ide/session.mjs';
import { SshWorkspaceClient, workspaceFile } from '../src/remote/ssh-workspace.mjs';
import { withSshFixture } from './ssh-fixture.mjs';
import { writeJson } from './lib.mjs';

const results = [];

class CaptureStream extends Writable {
  constructor() {
    super();
    this.text = '';
    this.columns = 100;
    this.rows = 30;
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

await test('MANUAL-MVP-001', 'end-user workflow uses help command palette mouse browse edit save search terminal resize dirty-exit and quit', async () => {
  await withSshFixture(async ({ target, workspace }) => {
    const output = new CaptureStream();
    const client = new SshWorkspaceClient(target);
    const session = new IdeSession({ client, workspace, remoteLabel: 'ssh:fixture', outputWriter: output });
    await session.initialize({ seedDemo: true });

    await session.runUserScript([
      '?',
      'escape',
      'ctrl+shift+p',
      'text:help',
      'enter',
      'escape',
      { type: 'mouse', x: 8, y: 5 },
      'enter',
      'i',
      'text:// end-user edit ',
      'ctrl+s',
      'escape',
      '/',
      'text:end-user',
      'enter',
      'ctrl+`',
      'text:/bin/echo ide-ok',
      'enter',
      'escape',
      'i',
      'text:// dirty-exit check ',
      'escape',
      'q',
      'escape',
      'ctrl+s',
      { type: 'resize', width: 140, height: 40 },
      { type: 'resize', width: 70, height: 24 },
      { type: 'resize', width: 52, height: 11 },
      'q'
    ]);

    const transcript = output.text;
    await mkdir('test-evidence/manual-product-mvp/frames', { recursive: true });
    await writeFile('test-evidence/manual-product-mvp/transcript.txt', transcript, 'utf8');
    for (const [index, frame] of session.renderedFrames.entries()) {
      const safeLabel = frame.label.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || `frame-${index}`;
      await writeFile(`test-evidence/manual-product-mvp/frames/${String(index).padStart(2, '0')}-${safeLabel}.txt`, frame.text, 'utf8');
    }

    const saved = await client.readFile(workspaceFile(workspace, 'src/app.ts'));
    assert(saved.includes('end-user edit'), 'manual edit must be saved remotely');

    assert(transcript.includes('Explorer'), 'transcript must show explorer');
    assert(transcript.includes('Editor: src/app.ts'), 'transcript must show active editor');
    assert(transcript.includes('Command help'), 'transcript must show command palette execution');
    assert(transcript.includes('INSERT'), 'transcript must show insert mode');
    assert(transcript.includes('Saved src/app.ts'), 'transcript must show save confirmation');
    assert(transcript.includes('Search results'), 'transcript must show search results');
    assert(transcript.includes('ide-ok'), 'transcript must show remote terminal command output');
    assert(transcript.includes('Unsaved changes'), 'transcript must show dirty-exit protection');
    assert(transcript.includes('Quit cancelled'), 'transcript must show dirty-exit cancellation');
    assert(transcript.includes('Smith needs more space'), 'transcript must show minimum resize-safe screen');
    assert(session.quitRequested, 'session must quit through user workflow');

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
  'test-evidence/manual-product-mvp/junit/manual-mvp.xml',
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
