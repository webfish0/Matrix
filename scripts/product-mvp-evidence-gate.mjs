import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeJson } from './lib.mjs';

const checks = [
  check('T-002', 'integration-ssh', 'test-evidence/mvp-1-remote-spine/results.json'),
  check('T-003', 'integration-ssh', 'test-evidence/mvp-1-remote-spine/results.json'),
  check('T-005-startup-smoke', 'component-terminal', 'test-evidence/mvp-1-remote-spine/results.json'),
  check('T-005-unit', 'component-terminal', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-005-startup-failure', 'component-terminal', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-005-capabilities', 'component-terminal', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-008', 'component-render', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-009', 'component-render', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-010-keypress', 'component-input', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-010-palette', 'component-input', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-010-quick-open', 'component-input', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-010-search-navigation', 'component-input', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-011', 'component-input', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-011-mouse-followup', 'component-input', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('T-004', 'integration-filesystem', 'test-evidence/mvp-3-remote-editing/results.json'),
  check('T-007', 'component-editor', 'test-evidence/mvp-3-remote-editing/results.json'),
  check('T-007-multibuffer', 'component-editor', 'test-evidence/mvp-2-terminal-workbench/results.json'),
  check('PMVP-001', 'integration-ssh', 'test-evidence/product-mvp/results.json'),
  check('PMVP-002', 'integration-ssh', 'test-evidence/product-mvp/results.json'),
  check('PMVP-003', 'integration-ssh', 'test-evidence/product-mvp/results.json'),
  check('USER-MVP-001', 'simulated-user-journey', 'test-evidence/manual-product-mvp/results.json'),
  check('USER-PTY-001', 'black-box-pty', 'test-evidence/pty-product-mvp/results.json'),
  check('T-005-sighup', 'black-box-pty', 'test-evidence/pty-product-mvp/results.json'),
  check('T-005-sigint', 'black-box-pty', 'test-evidence/pty-product-mvp/results.json'),
  check('T-005-sigterm', 'black-box-pty', 'test-evidence/pty-product-mvp/results.json')
];

const stories = [
  story('US-MVP-001', 'Launch and orient', ['PMVP-001', 'USER-PTY-001']),
  story('US-MVP-002', 'Browse remote files', ['T-010-quick-open', 'T-011', 'USER-MVP-001', 'USER-PTY-001']),
  story('US-MVP-003', 'Edit, preserve buffers, save and recover from save failure', ['T-007', 'T-007-multibuffer', 'PMVP-001', 'USER-PTY-001']),
  story('US-MVP-004', 'Search and navigate to a result', ['T-010-search-navigation', 'PMVP-001', 'USER-PTY-001']),
  story('US-MVP-005', 'Run a persistent remote command session in workspace context', ['PMVP-003', 'USER-PTY-001']),
  story('US-MVP-006', 'Discover commands and disabled reasons', ['T-010-palette', 'USER-PTY-001']),
  story('US-MVP-007', 'Resize safely', ['T-009', 'USER-PTY-001']),
  story('US-MVP-008', 'Exit without data loss and restore terminal', [
    'T-005-startup-failure',
    'T-005-sighup',
    'T-005-sigint',
    'T-005-sigterm',
    'USER-MVP-001',
    'USER-PTY-001'
  ])
];

const requiredArtifacts = [
  'test-evidence/pty-product-mvp/transcript.ansi',
  'test-evidence/pty-product-mvp/transcript.txt',
  'test-evidence/pty-product-mvp/user-journey.json',
  'test-evidence/pty-product-mvp/signal-sighup-transcript.ansi',
  'test-evidence/pty-product-mvp/signal-sigint-transcript.ansi',
  'test-evidence/pty-product-mvp/signal-sigterm-transcript.ansi',
  'test-evidence/pty-product-mvp/screenshots/frames/initial.png',
  'test-evidence/pty-product-mvp/screenshots/frames/command-palette.png',
  'test-evidence/pty-product-mvp/screenshots/frames/quick-open.png',
  'test-evidence/pty-product-mvp/screenshots/frames/dirty-buffer-switch.png',
  'test-evidence/pty-product-mvp/screenshots/frames/remote-terminal.png',
  'test-evidence/pty-product-mvp/screenshots/frames/search-results.png',
  'test-evidence/pty-product-mvp/screenshots/frames/save-failure.png',
  'test-evidence/pty-product-mvp/screenshots/frames/dirty-exit.png',
  'test-evidence/pty-product-mvp/screenshots/frames/narrow-layout.png',
  'test-evidence/pty-product-mvp/screenshots/frames/minimum-layout.png'
];

const loaded = new Map();
const evaluatedChecks = [];
for (const expected of checks) {
  if (!loaded.has(expected.path)) {
    loaded.set(expected.path, JSON.parse(await readFile(expected.path, 'utf8')));
  }
  const result = loaded.get(expected.path).results.find((candidate) => candidate.id === expected.id);
  evaluatedChecks.push({
    ...expected,
    status: result?.status ?? 'missing',
    durationMs: result?.durationMs ?? null,
    message: result?.message ?? null
  });
}

const artifactResults = [];
for (const path of requiredArtifacts) {
  try {
    await access(path);
    artifactResults.push({ path, status: 'present' });
  } catch {
    artifactResults.push({ path, status: 'missing' });
  }
}

const checkById = new Map(evaluatedChecks.map((item) => [item.id, item]));
const evaluatedStories = stories.map((item) => {
  const evidence = item.evidence.map((id) => checkById.get(id)).filter(Boolean);
  const hasBlackBox = evidence.some((entry) => entry.level === 'black-box-pty' && entry.status === 'passed');
  const passed = evidence.length === item.evidence.length && evidence.every((entry) => entry.status === 'passed') && hasBlackBox;
  return { ...item, status: passed ? 'passed' : 'failed', hasBlackBox };
});

const failures = [
  ...evaluatedChecks.filter((item) => item.status !== 'passed').map((item) => `${item.id}: ${item.status}`),
  ...evaluatedStories.filter((item) => item.status !== 'passed').map((item) => `${item.id}: missing required evidence`),
  ...artifactResults.filter((item) => item.status !== 'present').map((item) => `${item.path}: missing`)
];
const automatedGate = failures.length === 0 ? 'passed' : 'failed';

const report = {
  schema: 'smith.product-mvp-evidence-gate.v1',
  generatedAt: new Date().toISOString(),
  automatedGate,
  liveUserAcceptance: {
    status: 'pending',
    reason: 'Automated PTY evidence cannot prove compatibility with the user’s actual terminal, SSH configuration and workflow.',
    command: 'npm run smith -- ide-demo'
  },
  evidenceLevels: [
    'component',
    'integration-ssh',
    'simulated-user-journey',
    'black-box-pty',
    'live-user-acceptance'
  ],
  stories: evaluatedStories,
  checks: evaluatedChecks,
  artifacts: artifactResults,
  failures
};

await mkdir('test-evidence/product-mvp-gate', { recursive: true });
await writeJson('test-evidence/product-mvp-gate/report.json', report);
await writeFile('test-evidence/product-mvp-gate/report.md', markdownReport(report), 'utf8');

console.log(`${automatedGate.toUpperCase()} Product MVP automated evidence gate`);
console.log('PENDING Live user acceptance in the user’s real terminal');
if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}

function check(id, level, path) {
  return { id, level, path };
}

function story(id, name, evidence) {
  return { id, name, evidence };
}

function markdownReport(report) {
  return [
    '# Product MVP evidence gate',
    '',
    `Automated gate: **${report.automatedGate.toUpperCase()}**`,
    '',
    `Live user acceptance: **${report.liveUserAcceptance.status.toUpperCase()}** — ${report.liveUserAcceptance.reason}`,
    '',
    '| Story | Outcome | Required evidence | Black-box PTY |',
    '| --- | --- | --- | --- |',
    ...report.stories.map((item) => `| ${item.id} ${item.name} | ${item.status} | ${item.evidence.join(', ')} | ${item.hasBlackBox ? 'yes' : 'no'} |`),
    '',
    '| Test | Level | Outcome |',
    '| --- | --- | --- |',
    ...report.checks.map((item) => `| ${item.id} | ${item.level} | ${item.status} |`),
    '',
    'The automated gate and live acceptance are deliberately separate. A passing automated gate is not a claim that the product has passed on every real terminal.',
    ''
  ].join('\n');
}
