import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  const svg = terminalSvg(text);
  await mkdir(capture.outputBase.split('/').slice(0, -1).join('/'), { recursive: true });
  await writeFile(`${capture.outputBase}.svg`, svg, 'utf8');
  await execFileAsync('rsvg-convert', ['-o', `${capture.outputBase}.png`, `${capture.outputBase}.svg`]);
  console.log(`Wrote ${capture.outputBase}.png`);
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
