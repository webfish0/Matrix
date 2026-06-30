import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const captures = [
  {
    input: 'test-evidence/manual-product-mvp/transcript.txt',
    outputBase: 'test-evidence/manual-product-mvp/screenshots/manual-session'
  },
  {
    input: 'test-evidence/product-mvp/frames/workbench-100x30.txt',
    outputBase: 'test-evidence/product-mvp/screenshots/workbench-100x30'
  }
];

for (const capture of captures) {
  const text = await readFile(capture.input, 'utf8');
  await renderTextCapture(text, capture.outputBase);
}

await renderManualKeyFrames();
await renderPtyKeyFrames();

async function renderManualKeyFrames() {
  const framesDir = 'test-evidence/manual-product-mvp/frames';
  const outputDir = 'test-evidence/manual-product-mvp/screenshots/frames';
  await rm(outputDir, { recursive: true, force: true });
  const frameFiles = (await readdir(framesDir)).filter((file) => file.endsWith('.txt')).sort();
  const loaded = [];
  for (const file of frameFiles) {
    loaded.push({ file, text: await readFile(`${framesDir}/${file}`, 'utf8') });
  }
  const selections = [
    ['initial', (frame, index) => index === 0 || frame.file.includes('orient-in-the-terminal-ide')],
    ['created-file', (frame) => frame.text.includes('Created notes/todo.md')],
    ['renamed-file', (frame) => frame.text.includes('Renamed notes/todo.md to notes/done.md')],
    ['delete-cancelled', (frame) => frame.text.includes('Delete cancelled.')],
    ['delete-confirmed', (frame) => frame.text.includes('Deleted notes/done.md')],
    ['search-results', (frame) => frame.text.includes('Search results')],
    ['terminal-command', (frame) => frame.text.includes('ide-ok') && frame.text.includes('exit 0')],
    ['minimum-size', (frame) => frame.text.includes('Smith needs more space')]
  ];
  for (const [name, predicate] of selections) {
    const match = loaded.find(predicate);
    if (match) {
      await renderTextCapture(match.text, `${outputDir}/${name}`);
    }
  }
}

async function renderPtyKeyFrames() {
  const framesDir = 'test-evidence/pty-product-mvp/frames';
  const outputDir = 'test-evidence/pty-product-mvp/screenshots/frames';
  await rm(outputDir, { recursive: true, force: true });
  const frameFiles = (await readdir(framesDir)).filter((file) => file.endsWith('.txt')).sort();
  const loaded = [];
  for (const file of frameFiles) {
    loaded.push({ file, text: await readFile(`${framesDir}/${file}`, 'utf8') });
  }
  const selections = [
    ['initial', (frame) => frame.file.includes('initial-ready-workbench')],
    ['command-palette', (frame) => frame.text.includes('Command palette:')],
    ['quick-open', (frame) => frame.text.includes('Quick Open') && frame.text.includes('README.md')],
    ['remote-terminal', (frame) => frame.text.includes('pty-terminal') && frame.text.includes('exit 0')],
    ['search-results', (frame) => frame.text.includes('Search results')],
    ['save-failure', (frame) => frame.text.includes('Permission denied.') && frame.text.includes('Unsaved changes')],
    ['dirty-exit', (frame) => frame.text.includes('Press s to save and quit')],
    ['narrow-layout', (frame) => frame.text.includes('Narrow layout')],
    ['minimum-layout', (frame) => frame.text.includes('Smith needs more space')]
  ];
  for (const [name, predicate] of selections) {
    const match = loaded.find(predicate);
    if (match) {
      await renderTextCapture(match.text, `${outputDir}/${name}`);
    }
  }
}

async function renderTextCapture(text, outputBase) {
  const svg = terminalSvg(text);
  await mkdir(outputBase.split('/').slice(0, -1).join('/'), { recursive: true });
  await writeFile(`${outputBase}.svg`, svg, 'utf8');
  await execFileAsync('rsvg-convert', ['-o', `${outputBase}.png`, `${outputBase}.svg`]);
  console.log(`Wrote ${outputBase}.png`);
}

function terminalSvg(text) {
  const lines = text.replace(/\t/gu, '  ').split(/\r?\n/u).slice(0, 80);
  const charWidth = 9;
  const lineHeight = 18;
  const padding = 18;
  const width = Math.max(900, Math.min(1600, Math.max(...lines.map((line) => line.length), 1) * charWidth + padding * 2));
  const height = Math.max(240, lines.length * lineHeight + padding * 2);
  const escaped = lines
    .map((line, index) => `<text x="${padding}" y="${padding + (index + 1) * lineHeight}">${escapeXml(line)}</text>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <style>
    text { font-family: Menlo, Consolas, Monaco, monospace; font-size: 14px; fill: #d1d5db; white-space: pre; }
  </style>
${escaped}
</svg>
`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
