import { mkdir, writeFile } from 'node:fs/promises';
import { codeActionView, completionView, diagnosticsView, hoverView } from '../src/editor/language-features.mjs';
import { classifyExtensionManifest } from '../src/extensions/compatibility.mjs';
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

await test('T-014', 'native extension contributions classify to terminal-safe surfaces', async () => {
  const report = classifyExtensionManifest({
    publisher: 'smith',
    name: 'fixture-language',
    extensionKind: ['workspace'],
    activationEvents: ['onLanguage:typescript'],
    contributes: {
      commands: [{ command: 'fixture.run', title: 'Run Fixture' }],
      keybindings: [{ command: 'fixture.run', key: 'ctrl+alt+r' }],
      configuration: { title: 'Fixture' },
      languages: [{ id: 'typescript' }],
      grammars: [{ language: 'typescript' }],
      views: { explorer: [{ id: 'fixtureView', name: 'Fixture' }] },
      taskDefinitions: [{ type: 'fixture' }],
      debuggers: [{ type: 'fixture' }]
    }
  });
  assert(report.level === 'native', 'native contribution set should classify as native');
  assert(report.contributions.every((entry) => entry.level === 'native'), 'all fixture contributions should be native');
});

await test('T-014-language', 'language feature view models expose terminal-safe completion diagnostics hover and actions', async () => {
  const completions = completionView({
    prefix: 'par',
    items: [
      { label: 'parseUser', detail: '(input: string) => User' },
      { label: 'readUser' }
    ]
  });
  const diagnostics = diagnosticsView([
    { relativePath: 'src/app.ts', severity: 'warning', message: 'Type mismatch', range: { start: 1, end: 1 }, source: 'fixture' }
  ]);
  const hover = hoverView({ contents: 'User\nParsed user value', range: { start: 1, end: 1 } });
  const actions = codeActionView([{ title: 'Add type guard', kind: 'quickfix', isPreferred: true }]);
  assert(completions.items.length === 1 && completions.items[0].label === 'parseUser', 'completion filtering should use prefix');
  assert(diagnostics[0].terminalMarker === 'W', 'diagnostic should include non-colour terminal marker');
  assert(hover.lines.length === 2, 'hover should split multiline content');
  assert(actions.actions[0].isPreferred === true, 'code action preferred flag should be preserved');
});

await test('T-015', 'unsupported graphical extension surfaces are explicit', async () => {
  const report = classifyExtensionManifest({
    publisher: 'smith',
    name: 'fixture-webview',
    contributes: {
      commands: [{ command: 'fixture.open', title: 'Open' }],
      webviews: [{ viewType: 'fixture.webview' }],
      customEditors: [{ viewType: 'fixture.custom', displayName: 'Fixture Custom' }],
      notebooks: [{ type: 'fixture-notebook' }]
    }
  });
  assert(report.level === 'unsupported-surfaces', 'webview/custom editor/notebook fixture should report unsupported surfaces');
  assert(report.contributions.filter((entry) => entry.level === 'unsupported').length === 3, 'all graphical surfaces should be listed as unsupported');
});

await test('T-016-subset', 'extension settings and keybinding contributions remain visible to configuration surfaces', async () => {
  const report = classifyExtensionManifest({
    publisher: 'smith',
    name: 'fixture-config',
    contributes: {
      configuration: {
        properties: {
          'fixture.enabled': { type: 'boolean', default: true }
        }
      },
      keybindings: [{ command: 'fixture.toggle', key: 'ctrl+alt+t' }],
      walkthroughs: [{ id: 'fixture.walkthrough', title: 'Fixture' }]
    }
  });
  assert(report.contributions.some((entry) => entry.key === 'configuration' && entry.level === 'native'), 'configuration should be native');
  assert(report.contributions.some((entry) => entry.key === 'keybindings' && entry.level === 'native'), 'keybindings should be native');
  assert(report.contributions.some((entry) => entry.key === 'walkthroughs' && entry.level === 'textual-fallback'), 'walkthroughs should use textual fallback');
});

const failed = results.filter((result) => result.status !== 'passed');
await mkdir('test-evidence/mvp-4-language-extensions/junit', { recursive: true });
await writeJson('test-evidence/mvp-4-language-extensions/results.json', {
  schema: 'smith.test-results.v1',
  suite: 'mvp-4-language-extensions',
  results
});
await writeFile(
  'test-evidence/mvp-4-language-extensions/junit/mvp4.xml',
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="mvp-4-language-extensions" tests="${results.length}" failures="${failed.length}">`,
    ...results.map((result) => {
      const failure = result.status === 'failed' ? `<failure>${escapeXml(result.message)}</failure>` : '';
      return `  <testcase classname="smith.mvp4" name="${escapeXml(`${result.id} ${result.name}`)}" time="${(result.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
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
