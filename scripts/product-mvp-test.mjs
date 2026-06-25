import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderWorkbench } from '../src/tui/render.mjs';
import { SshWorkspaceClient, workspaceFile } from '../src/remote/ssh-workspace.mjs';
import { withSshFixture } from './ssh-fixture.mjs';
import { writeJson } from './lib.mjs';

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
