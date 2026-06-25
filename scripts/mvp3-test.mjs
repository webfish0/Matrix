import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextBuffer, displayCellWidth, graphemeCount, utf16PositionAt } from '../src/editor/text-buffer.mjs';
import { WorkspaceFileService } from '../src/workspace/file-service.mjs';
import { explorerView, outputView, problemsView, searchView } from '../src/workbench/view-models.mjs';
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

await test('T-004', 'workspace file service supports read write list rename delete and search', async () => {
  await withFixture(async ({ service }) => {
    await service.writeText('src/app.ts', 'export const value = 1;\n');
    await service.writeText('README.md', '# fixture\n');
    const tree = await service.listTree('.');
    assert(tree.some((entry) => entry.relativePath === 'src' && entry.kind === 'directory'), 'Explorer tree should include src directory');
    const read = await service.readText('src/app.ts');
    assert(read.content.includes('value'), 'readText should return file content');
    await service.rename('src/app.ts', 'src/main.ts');
    assert((await service.readText('src/main.ts')).content.includes('value'), 'rename should move file');
    const search = await service.searchText('value');
    assert(search.length === 1 && search[0].relativePath === 'src/main.ts', 'search should find renamed file');
    await service.delete('README.md');
  });
});

await test('T-006', 'Unicode helpers distinguish UTF-16 positions graphemes and display cells', async () => {
  const content = 'a😀\n界é\n';
  const position = utf16PositionAt(content, content.indexOf('界'));
  assert(position.line === 2 && position.column === 1, 'UTF-16 position should identify second line');
  assert(graphemeCount('é') === 1, 'combining sequence should count as one grapheme');
  assert(displayCellWidth('界') === 2, 'CJK character should occupy two display cells');
});

await test('T-007', 'text buffer supports edit undo redo save and conflict detection', async () => {
  await withFixture(async ({ service }) => {
    const version = await service.writeText('src/app.ts', 'hello world\n');
    const document = await service.readText('src/app.ts');
    const buffer = new TextBuffer(document);
    buffer.replace({ start: { line: 1, column: 7 }, end: { line: 1, column: 12 } }, 'smith');
    assert(buffer.content === 'hello smith\n', 'replace should update content');
    assert(buffer.undo() && buffer.content === 'hello world\n', 'undo should restore content');
    assert(buffer.redo() && buffer.content === 'hello smith\n', 'redo should restore edit');
    await service.writeText('src/app.ts', 'external change\n', { expectedVersion: version });
    let conflict = false;
    try {
      await service.writeText('src/app.ts', buffer.content, { expectedVersion: document.version });
    } catch {
      conflict = true;
    }
    assert(conflict, 'save with stale version should report conflict');
  });
});

await test('T-013-subset', 'Explorer Search Problems and Output view models are usable', async () => {
  await withFixture(async ({ service }) => {
    await service.writeText('src/app.ts', 'const problem = true;\n');
    await service.writeText('src/test.ts', 'problem();\n');
    const explorer = await explorerView(service);
    const search = await searchView(service, 'problem');
    const problems = problemsView([
      { relativePath: 'src/app.ts', severity: 'warning', message: 'Example warning', line: 1, column: 7 }
    ]);
    const output = outputView({ channel: 'Smith', lines: ['one', 'two', 'three'], limit: 2 });
    assert(explorer.entries.some((entry) => entry.relativePath === 'src'), 'Explorer should list src');
    assert(search.results.length === 2, 'Search should find two results');
    assert(problems.count === 1 && problems.groups[0].relativePath === 'src/app.ts', 'Problems should group diagnostics by file');
    assert(output.truncated === true && output.lines.length === 2, 'Output should bound history');
  });
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/mvp-3-remote-editing/junit', { recursive: true });
await writeJson('test-evidence/mvp-3-remote-editing/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'mvp-3-remote-editing',
  results
});
await writeFile(
  'test-evidence/mvp-3-remote-editing/junit/mvp3.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="mvp-3-remote-editing" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.mvp3" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
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

async function withFixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'smith-mvp3-'));
  try {
    await mkdir(join(root, 'src'), { recursive: true });
    await fn({ root, service: new WorkspaceFileService(root) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
