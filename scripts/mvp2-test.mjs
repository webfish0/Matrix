import { mkdir, writeFile } from 'node:fs/promises';
import { resolveKeybinding } from '../src/tui/commands.mjs';
import { computeLayout } from '../src/tui/layout.mjs';
import { renderWorkbench, routePointer } from '../src/tui/render.mjs';
import { TerminalScreen } from '../src/tui/terminal-screen.mjs';
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

await test('T-008', 'workbench renders deterministic frames across responsive modes', async () => {
  const wide = renderWorkbench({ width: 140, height: 40, state: baseState() });
  const medium = renderWorkbench({ width: 100, height: 30, state: baseState() });
  const narrow = renderWorkbench({ width: 70, height: 24, state: baseState() });
  const minimum = renderWorkbench({ width: 52, height: 11, state: baseState() });
  assert(wide.layout.mode === 'wide', 'wide frame mode mismatch');
  assert(medium.layout.mode === 'medium', 'medium frame mode mismatch');
  assert(narrow.layout.mode === 'narrow', 'narrow frame mode mismatch');
  assert(minimum.layout.mode === 'minimum', 'minimum frame mode mismatch');
  assert(wide.rows.length === 40 && wide.rows.every((row) => row.length === 140), 'wide frame dimensions invalid');
  assert(minimum.text.includes('Smith needs more space'), 'minimum frame must show resize message');
  assert(medium.layout.regions.activity.width === 0, 'activity rail must be hidden until it has useful MVP behavior');
  assert(!medium.hitRegions.some((region) => region.id === 'activity'), 'activity rail hit region must not exist when hidden');
});

await test('T-009', 'resize layout preserves editor and rebuilds hit regions', async () => {
  const wide = renderWorkbench({ width: 140, height: 40, state: baseState() });
  const medium = renderWorkbench({ width: 100, height: 30, state: baseState() });
  assert(wide.layout.regions.editor.width > medium.layout.regions.editor.width, 'editor should resize with terminal width');
  assert(wide.hitRegions !== medium.hitRegions, 'hit regions must be rebuilt per frame');
  assert(medium.hitRegions.some((region) => region.id === 'editor'), 'editor hit region must remain present');
  assert(computeLayout({ width: 52, height: 11 }).collapse.includes('workbench'), 'minimum mode must collapse workbench');
});

await test('T-010', 'core keyboard commands resolve with terminal-aware enablement', async () => {
  assert(resolveKeybinding('ctrl+p').command === 'workbench.action.quickOpen', 'Ctrl+P should open quick open');
  assert(resolveKeybinding('ctrl+shift+p').command === 'workbench.action.showCommands', 'Ctrl+Shift+P should open commands');
  const captured = resolveKeybinding('ctrl+p', { terminalFocus: true });
  assert(captured.enabled === false && captured.reason.includes('terminal focus'), 'terminal focus should report captured keybinding');
});

await test('T-011', 'mouse hit routing selects topmost region', async () => {
  const narrow = renderWorkbench({ width: 70, height: 24, state: baseState() });
  const overlay = narrow.hitRegions.find((region) => region.id === 'overlay.commandHint');
  assert(Boolean(overlay), 'narrow frame should include command hint overlay');
  const hit = routePointer(narrow.hitRegions, { x: overlay.rect.x + 1, y: overlay.rect.y + 1 });
  assert(hit.id === 'overlay.commandHint', 'topmost overlay should receive pointer hit');
  const editor = routePointer(narrow.hitRegions, { x: narrow.layout.regions.editor.x + 2, y: narrow.layout.regions.editor.y + 2 });
  assert(editor.id === 'editor' || editor.id === 'overlay.commandHint', 'pointer must route to current semantic hit region');
});

await test('T-012-smoke', 'internal terminal screen model bounds child process output', async () => {
  const screen = new TerminalScreen({ width: 12, height: 3, scrollbackLimit: 2 });
  screen.write('hello\\n\\u001b[31mred\\u001b[0m\\nthird\\nfourth');
  const snapshot = screen.snapshot();
  assert(snapshot.length === 3, 'terminal screen height must remain bounded');
  assert(snapshot.every((row) => row.length === 12), 'terminal screen width must remain bounded');
  assert(!snapshot.join('\\n').includes('\\u001b'), 'ANSI control sequences must not leak into outer terminal frame');
  assert(screen.scrollback.length <= 2, 'scrollback must respect configured bound');
  screen.resize({ width: 8, height: 2 });
  assert(screen.snapshot().length === 2, 'resize must update terminal screen height');
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/mvp-2-terminal-workbench/junit', { recursive: true });
await writeJson('test-evidence/mvp-2-terminal-workbench/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'mvp-2-terminal-workbench',
  results
});
await writeFile(
  'test-evidence/mvp-2-terminal-workbench/junit/mvp2.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="mvp-2-terminal-workbench" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.mvp2" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
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

function baseState() {
  return {
    workspace: 'devbox:/repo',
    remote: 'ssh:devbox',
    branch: 'main*',
    connection: 'ready',
    activeFile: 'app.ts',
    unsaved: 1
  };
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
