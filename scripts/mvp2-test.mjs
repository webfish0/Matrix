import { mkdir, writeFile } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { normalizeTerminalKey, resolveKeybinding } from '../src/tui/commands.mjs';
import { computeLayout } from '../src/tui/layout.mjs';
import { renderWorkbench, routePointer } from '../src/tui/render.mjs';
import { TerminalScreen } from '../src/tui/terminal-screen.mjs';
import {
  signalExitCode,
  terminalCapabilities,
  TerminalLifecycle,
  TERMINAL_ENTER_SEQUENCE,
  TERMINAL_RESTORE_SEQUENCE
} from '../src/tui/terminal-lifecycle.mjs';
import { IdeSession } from '../src/ide/session.mjs';
import { writeJson } from './lib.mjs';

const results = [];

class NullStream extends Writable {
  constructor() {
    super();
    this.columns = 100;
    this.rows = 30;
  }

  _write(_chunk, _encoding, callback) {
    callback();
  }
}

class FakeClient {
  async writeFile() {}

  async readFile() {
    return 'first line\nmatching hello line\n';
  }

  async list(path) {
    if (path.endsWith('/src')) {
      return [
        { name: 'app.ts', kind: 'file' },
        { name: 'app.test.ts', kind: 'file' }
      ];
    }
    return [
      { name: 'src', kind: 'directory' },
      { name: 'README.md', kind: 'file' }
    ];
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

await test('T-005-unit', 'terminal lifecycle enters and restores modes exactly once', async () => {
  const rawModes = [];
  const writes = [];
  let resumed = 0;
  let paused = 0;
  const lifecycle = new TerminalLifecycle({
    input: {
      setRawMode: (enabled) => rawModes.push(enabled),
      resume: () => { resumed += 1; },
      pause: () => { paused += 1; }
    },
    output: {
      write: (text) => writes.push(text)
    }
  });
  assert(lifecycle.enter() === true && lifecycle.enter() === false, 'terminal entry should be idempotent');
  assert(lifecycle.restore() === true && lifecycle.restore() === false, 'terminal restoration should be idempotent');
  assert(JSON.stringify(rawModes) === JSON.stringify([true, false]), 'raw mode should be enabled and disabled once');
  assert(resumed === 1 && paused === 1, 'input should resume on entry and pause on restoration');
  assert(writes[0] === TERMINAL_ENTER_SEQUENCE && writes[1] === TERMINAL_RESTORE_SEQUENCE, 'terminal mode sequences should be paired');
  assert(signalExitCode('SIGINT') === 130 && signalExitCode('SIGTERM') === 143, 'signal exit codes should follow shell convention');
});

await test('T-005-startup-failure', 'terminal lifecycle restores raw mode when startup output fails', async () => {
  const rawModes = [];
  let writeCount = 0;
  const lifecycle = new TerminalLifecycle({
    input: {
      setRawMode: (enabled) => rawModes.push(enabled),
      resume() {},
      pause() {}
    },
    output: {
      write() {
        writeCount += 1;
        if (writeCount === 1) throw new Error('injected terminal startup failure');
      }
    }
  });
  let failed = false;
  try {
    lifecycle.enter();
  } catch {
    failed = true;
  } finally {
    lifecycle.restore();
  }
  assert(failed, 'startup failure should propagate');
  assert(JSON.stringify(rawModes) === JSON.stringify([true, false]), 'startup failure must still disable raw mode');
  assert(writeCount === 2, 'restoration sequence should be attempted after failed entry');
});

await test('T-005-capabilities', 'terminal diagnostics choose interactive and conservative profiles', async () => {
  const interactive = terminalCapabilities({
    input: { isTTY: true },
    output: { isTTY: true },
    env: { TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: 'en_GB.UTF-8' }
  });
  const conservative = terminalCapabilities({
    input: { isTTY: false },
    output: { isTTY: false },
    env: { TERM: 'dumb', LANG: 'C' }
  });
  assert(interactive.profile === 'interactive' && interactive.color === 'truecolor' && interactive.sgrMouse, 'interactive profile should expose supported capabilities');
  assert(conservative.profile === 'conservative' && !conservative.sgrMouse && !conservative.alternateScreen, 'non-TTY profile should disable unsafe capabilities');
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
  assert(resolveKeybinding('f1').command === 'workbench.action.showCommands', 'F1 should open command palette');
  assert(resolveKeybinding(':').command === 'workbench.action.showCommands', ': should open command palette');
  assert(resolveKeybinding('ctrl+p').command === 'workbench.action.quickOpen', 'Ctrl+P should open quick open');
  assert(resolveKeybinding('f2').command === 'workbench.action.terminal.toggleTerminal', 'F2 should open terminal');
  assert(resolveKeybinding('ctrl+shift+p').command === 'workbench.action.showCommands', 'Ctrl+Shift+P should remain optional command alias when reported');
  const captured = resolveKeybinding('ctrl+p', { terminalFocus: true });
  assert(captured.enabled === false && captured.reason.includes('terminal focus'), 'terminal focus should report captured keybinding');
});

await test('T-010-keypress', 'actual terminal keypress objects route to visible MVP commands', async () => {
  assert(normalizeTerminalKey({ name: 'return' }, '\r') === 'enter', 'return key should normalize to enter');
  assert(normalizeTerminalKey({ name: 'f1' }, '') === 'f1', 'F1 should normalize');
  assert(normalizeTerminalKey({}, ':') === ':', 'colon should normalize as command key');
  assert(normalizeTerminalKey({ ctrl: true, name: 'p' }, '\u0010') === 'ctrl+p', 'Ctrl+P should normalize');
  assert(normalizeTerminalKey({ name: 'f2' }, '') === 'f2', 'F2 should normalize');

  const session = new IdeSession({ client: new FakeClient(), workspace: '/workspace', outputWriter: new NullStream() });
  await session.handleKey({ name: 'f1' }, '');
  assert(session.mode === 'command' && session.minibuffer.prompt === 'Command palette:', 'F1 keypress should open command palette');
  await session.handleKey({ name: 'escape' }, '\u001b');
  await session.handleKey({}, ':');
  assert(session.mode === 'command' && session.minibuffer.prompt === 'Command palette:', 'colon keypress should open command palette');
  await session.handleKey({ name: 'escape' }, '\u001b');
  await session.handleKey({ ctrl: true, name: 'p' }, '\u0010');
  assert(session.mode === 'command' && session.minibuffer.kind === 'quickOpen', 'Ctrl+P keypress should open quick open');
  await session.handleKey({ name: 'escape' }, '\u001b');
  await session.handleKey({ name: 'f2' }, '');
  assert(session.mode === 'terminal' && session.focus === 'panel', 'F2 keypress should focus terminal panel');

  session.mode = 'normal';
  session.focus = 'editor';
  session.activeFile = 'src/app.ts';
  session.bufferLines = ['abc'];
  session.cursor = { line: 0, column: 0 };
  await session.handleKey({ name: 'i' }, 'i');
  assert(session.mode === 'insert', 'i keypress in Normal mode should enter Insert mode');
  assert(session.bufferLines[0] === 'abc', 'i keypress in Normal mode must not insert text');
  await session.handleKey({ name: 'x' }, 'x');
  assert(session.bufferLines[0] === 'xabc', 'printable key in Insert mode should insert text');
});

await test('T-010-palette', 'command palette filters, shows shortcuts and explains disabled commands', async () => {
  const session = new IdeSession({ client: new FakeClient(), workspace: '/workspace', outputWriter: new NullStream() });
  session.activeFile = 'src/app.ts';
  session.bufferLines = ['abc'];
  session.openCommandPalette();
  assert(session.minibuffer.items.some((item) => item.shortcut === 'Ctrl+S'), 'palette should show command shortcuts');
  await session.handleText('debug');
  assert(session.minibuffer.items.length === 1, 'palette should filter commands by typed query');
  assert(session.minibuffer.items[0].enabled === false, 'unsupported debugger command should be visibly disabled');
  await session.handleNamedKey('enter');
  assert(session.mode === 'command', 'disabled command should leave palette open');
  assert(session.minibuffer.message.includes('Requires post-MVP'), 'disabled command should explain why it is unavailable');
  const frame = session.renderFrame();
  assert(frame.text.includes('Debug: Start'), 'filtered command should be rendered');
  assert(frame.text.includes('Disabled: Requires post-MVP'), 'disabled reason should be rendered');
});

await test('T-010-quick-open', 'Quick Open filters visible remote files and opens the selected result', async () => {
  const session = new IdeSession({ client: new FakeClient(), workspace: '/workspace', outputWriter: new NullStream() });
  session.activeFile = 'src/app.ts';
  session.bufferLines = ['abc'];
  await session.openQuickOpen();
  assert(session.minibuffer.items.length === 3, 'Quick Open should recursively list remote workspace files');
  await session.handleText('app');
  assert(session.minibuffer.items.length === 2, 'Quick Open should filter paths as the user types');
  await session.handleNamedKey('down');
  const selectedPath = session.minibuffer.items[1].path;
  const frame = session.renderFrame();
  assert(frame.text.includes('Quick Open') && frame.text.includes(selectedPath), 'Quick Open should render the selected path before opening');
  await session.handleNamedKey('enter');
  assert(session.activeFile === selectedPath && session.focus === 'editor', 'Enter should open the selected Quick Open result');

  await session.openQuickOpen();
  await session.handleText('missing');
  assert(session.minibuffer.items.length === 0, 'no-match state should contain no selectable results');
  assert(session.renderFrame().text.includes('No file found for missing.'), 'no-match state should be explicit');
  await session.handleNamedKey('escape');
  assert(session.activeFile === selectedPath, 'cancelling Quick Open must preserve active editor');
});

await test('T-010-search-navigation', 'keyboard selection opens a workspace search result at its line', async () => {
  const session = new IdeSession({ client: new FakeClient(), workspace: '/workspace', outputWriter: new NullStream() });
  session.lastSearch = [
    { relativePath: 'src/app.ts', line: 2, column: 10, preview: 'matching hello line' }
  ];
  session.focus = 'panel';
  await session.handleNamedKey('enter');
  assert(session.activeFile === 'src/app.ts', 'Enter should open selected search result');
  assert(session.focus === 'editor', 'opening a search result should focus the editor');
  assert(session.cursor.line === 1 && session.cursor.column === 9, 'result should open at its one-based line and column');
});

await test('T-011-mouse-followup', 'a normal key immediately after mouse input is not suppressed', async () => {
  const session = new IdeSession({ client: new FakeClient(), workspace: '/workspace', outputWriter: new NullStream() });
  session.suppressKeypressUntil = Date.now() + 100;
  assert(session.shouldSuppressKeypress('q', { name: 'q', sequence: 'q' }) === false, 'q after a click must not be dropped');
  assert(session.shouldSuppressKeypress('', { sequence: '\u001b[<0;8;6M' }) === true, 'mouse control sequence should remain suppressed');
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
