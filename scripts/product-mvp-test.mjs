import { mkdir, writeFile } from 'node:fs/promises';
import { IdeSession } from '../src/ide/session.mjs';
import { renderWorkbench } from '../src/tui/render.mjs';
import { SshWorkspaceClient, workspaceFile } from '../src/remote/ssh-workspace.mjs';
import { withSshFixture } from './ssh-fixture.mjs';
import { writeJson } from './lib.mjs';

const results = [];

class CaptureStream {
  constructor() {
    this.text = '';
  }

  write(chunk) {
    this.text += chunk.toString();
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

await test('PMVP-001', 'opens SSH workspace and performs terminal IDE baseline flow', async () => {
  await withSshFixture(async ({ target, workspace }) => {
    const client = new SshWorkspaceClient(target);
    await client.ensureWorkspace(workspace);

    const appFile = workspaceFile(workspace, 'src/app.ts');
    await client.writeFile(appFile, 'export const message = "hello";\n');

    const tree = await client.list(workspace);
    assert(tree.some((entry) => entry.name === 'src' && entry.kind === 'directory'), 'Explorer must browse remote workspace');

    const opened = await client.readFile(appFile);
    assert(opened.includes('hello'), 'Editor must open remote text file');

    await client.writeFile(appFile, opened.replace('hello', 'smith'));
    const saved = await client.readFile(appFile);
    assert(saved.includes('smith'), 'Editor must save remote text file');

    const search = await client.search(workspace, 'smith');
    assert(search.length === 1 && search[0].relativePath === 'src/app.ts', 'Search must find remote text');

    const terminal = await client.runTerminalCommand('/bin/echo', ['terminal-ok']);
    assert(terminal.status === 0 && terminal.stdout.trim() === 'terminal-ok', 'Integrated terminal command must execute remotely');

    const frame = renderWorkbench({
      width: 100,
      height: 30,
      state: {
        workspace: `ssh:${target.host}:${workspace}`,
        remote: `ssh:${target.host}`,
        connection: 'ready',
        activeFile: 'app.ts',
        branch: 'main'
      }
    });
    assert(frame.text.includes('Editor: app.ts'), 'TUI frame must include editor');
    assert(frame.text.includes('Terminal'), 'TUI frame must include terminal panel');

    await mkdir('test-evidence/product-mvp/frames', { recursive: true });
    await writeFile('test-evidence/product-mvp/frames/workbench-100x30.txt', frame.text, 'utf8');
  });
});

await test('PMVP-002', 'supplied-target initialization does not overwrite workspace files', async () => {
  await withSshFixture(async ({ target, workspace }) => {
    const output = new CaptureStream();
    const client = new SshWorkspaceClient(target);
    await client.ensureWorkspace(workspace);
    await client.writeFile(workspaceFile(workspace, 'README.md'), 'do not overwrite\n');
    const session = new IdeSession({ client, workspace, remoteLabel: 'ssh:supplied', outputWriter: output });
    await session.initialize({ seedDemo: false });
    const readme = await client.readFile(workspaceFile(workspace, 'README.md'));
    assert(readme === 'do not overwrite\n', 'supplied-target initialization must not overwrite user files');
  });
});

await test('PMVP-003', 'persistent remote terminal preserves shell state, status and size', async () => {
  await withSshFixture(async ({ target, workspace }) => {
    const client = new SshWorkspaceClient(target);
    await client.ensureWorkspace(workspaceFile(workspace, 'src'));
    const terminal = await client.openTerminal(workspace, { width: 80, height: 20, outputLimit: 1024 });
    try {
      const initial = await terminal.runCommand('pwd');
      assert(initial.status === 0 && initial.stdout.includes(workspace), 'persistent terminal must start in remote workspace');

      const change = await terminal.runCommand('cd src');
      assert(change.status === 0, 'cd should succeed in persistent shell');
      const afterChange = await terminal.runCommand('pwd');
      assert(afterChange.stdout.includes(`${workspace}/src`), 'cwd change must persist across commands');

      const failure = await terminal.runCommand('false');
      assert(failure.status !== 0, 'non-zero remote command status must be reported');

      const [firstQueued, secondQueued] = await Promise.all([
        terminal.runCommand('printf first'),
        terminal.runCommand('printf second')
      ]);
      assert(firstQueued.stdout.includes('first') && secondQueued.stdout.includes('second'), 'concurrent requests should execute through a serialized command queue');

      const bounded = await terminal.runCommand("yes x | head -c 4096");
      assert(bounded.stdout.length <= 1024, 'remote terminal command capture must respect output bound');

      await terminal.resize({ width: 91, height: 27 });
      const size = await terminal.runCommand('stty size');
      assert(size.stdout.includes('27 91'), 'remote PTY should receive requested row and column size');
      assert(terminal.snapshot().length === 27, 'terminal screen model should resize with remote PTY');
    } finally {
      await terminal.close();
    }
    assert(terminal.closed, 'closing Smith terminal should close persistent SSH process');
  });
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/product-mvp/junit', { recursive: true });
await writeJson('test-evidence/product-mvp/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'product-mvp',
  results
});
await writeFile(
  'test-evidence/product-mvp/junit/product-mvp.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="product-mvp" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.product-mvp" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
    }),
    '</testsuite>',
    ''
  ].join('\n'),
  'utf8'
);
await writeJson('test-evidence/product-mvp/manifest.json', {
  schema: 'smith.product-mvp-evidence.v1',
  suite: 'product-mvp',
  requirements: [
    'connect-over-ssh',
    'browse-remote-workspace',
    'open-edit-save-remote-file',
    'search-remote-workspace',
    'run-remote-terminal-command',
    'render-terminal-workbench'
  ],
  results
});

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
