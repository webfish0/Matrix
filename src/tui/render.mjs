import { computeLayout } from './layout.mjs';

export function renderWorkbench({ width, height, state = {} }) {
  const layout = computeLayout({ width, height });
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));
  const hitRegions = [];

  if (layout.mode === 'minimum') {
    writeText(cells, 1, 1, 'Smith needs more space');
    writeText(cells, 1, 2, `Current: ${width}x${height}   Minimum: 60x14`);
    writeText(cells, 1, 3, `Connection: ${state.connection ?? 'unknown'}   Unsaved: ${state.unsaved ?? 0}`);
    hitRegions.push(region('message', layout.regions.message, 0, ['focus']));
    return frame(layout, cells, hitRegions);
  }

  const { regions } = layout;
  fillRegion(cells, regions.title, '─');
  writeText(cells, 1, 0, `Smith ${state.workspace ?? 'workspace'} ${state.remote ?? ''}`.trim());
  hitRegions.push(region('title', regions.title, 10, ['focus', 'menu']));

  if (regions.activity.width > 0) {
    drawBox(cells, regions.activity, 'A');
    writeVertical(cells, regions.activity.x + 1, regions.activity.y + 1, ['E', 'S', 'G', 'D', 'T', 'X']);
    hitRegions.push(region('activity', regions.activity, 10, ['click', 'wheel', 'context']));
  }

  if (regions.primarySideBar.width > 0) {
    drawBox(cells, regions.primarySideBar, 'Explorer');
    writeText(cells, regions.primarySideBar.x + 1, regions.primarySideBar.y + 1, '▾ repo');
    writeText(cells, regions.primarySideBar.x + 1, regions.primarySideBar.y + 2, '  ▾ src');
    writeText(cells, regions.primarySideBar.x + 1, regions.primarySideBar.y + 3, '    app.ts ●');
    hitRegions.push(region('primarySideBar', regions.primarySideBar, 10, ['click', 'wheel', 'context']));
  }

  drawBox(cells, regions.editor, `Editor: ${state.activeFile ?? 'app.ts'}`);
  writeText(cells, regions.editor.x + 1, regions.editor.y + 1, '1 function main() {');
  writeText(cells, regions.editor.x + 1, regions.editor.y + 2, '2   return call();');
  writeText(cells, regions.editor.x + 1, regions.editor.y + 3, '3 }');
  hitRegions.push(region('editor', regions.editor, 10, ['click', 'drag', 'wheel', 'context']));

  if (regions.secondarySideBar.width > 0) {
    drawBox(cells, regions.secondarySideBar, 'Outline');
    writeText(cells, regions.secondarySideBar.x + 1, regions.secondarySideBar.y + 1, 'main()');
    hitRegions.push(region('secondarySideBar', regions.secondarySideBar, 10, ['click', 'wheel']));
  }

  if (regions.panel.height > 0) {
    drawBox(cells, regions.panel, 'Terminal');
    writeText(cells, regions.panel.x + 1, regions.panel.y + 1, '$ npm test');
    hitRegions.push(region('panel', regions.panel, 10, ['click', 'drag', 'wheel', 'context']));
  }

  fillRegion(cells, regions.status, ' ');
  writeText(cells, 0, regions.status.y, `= ${state.remote ?? 'local'} ${state.branch ?? 'main'} ${state.connection ?? 'ready'} Ln 1, Col 1`);
  hitRegions.push(region('status', regions.status, 10, ['click']));

  if (layout.mode === 'narrow') {
    const overlay = centered(width, height, 48, 10);
    drawBox(cells, overlay, 'Command hint');
    writeText(cells, overlay.x + 1, overlay.y + 1, 'Ctrl+P Quick Open');
    writeText(cells, overlay.x + 1, overlay.y + 2, 'Ctrl+Shift+P Command Palette');
    hitRegions.push(region('overlay.commandHint', overlay, 30, ['click', 'escape']));
  }

  return frame(layout, cells, hitRegions);
}

export function routePointer(hitRegions, { x, y }) {
  return hitRegions
    .filter((candidate) => contains(candidate.rect, x, y))
    .sort((a, b) => b.z - a.z)[0] ?? null;
}

function frame(layout, cells, hitRegions) {
  return {
    layout,
    text: cells.map((row) => row.join('')).join('\n'),
    rows: cells.map((row) => row.join('')),
    hitRegions
  };
}

function drawBox(cells, area, title) {
  if (area.width <= 0 || area.height <= 0) return;
  const right = area.x + area.width - 1;
  const bottom = area.y + area.height - 1;
  for (let x = area.x; x <= right; x++) {
    setCell(cells, x, area.y, '─');
    setCell(cells, x, bottom, '─');
  }
  for (let y = area.y; y <= bottom; y++) {
    setCell(cells, area.x, y, '│');
    setCell(cells, right, y, '│');
  }
  setCell(cells, area.x, area.y, '┌');
  setCell(cells, right, area.y, '┐');
  setCell(cells, area.x, bottom, '└');
  setCell(cells, right, bottom, '┘');
  writeText(cells, area.x + 1, area.y, ` ${title} `);
}

function fillRegion(cells, area, char) {
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      setCell(cells, x, y, char);
    }
  }
}

function writeText(cells, x, y, text) {
  for (let index = 0; index < text.length; index++) {
    setCell(cells, x + index, y, text[index]);
  }
}

function writeVertical(cells, x, y, lines) {
  lines.forEach((line, index) => writeText(cells, x, y + index, line));
}

function setCell(cells, x, y, char) {
  if (y >= 0 && y < cells.length && x >= 0 && x < cells[y].length) {
    cells[y][x] = char;
  }
}

function region(id, area, z, gestures) {
  return { id, rect: area, z, gestures };
}

function contains(area, x, y) {
  return x >= area.x && y >= area.y && x < area.x + area.width && y < area.y + area.height;
}

function centered(width, height, preferredWidth, preferredHeight) {
  const overlayWidth = Math.min(preferredWidth, Math.max(20, width - 4));
  const overlayHeight = Math.min(preferredHeight, Math.max(6, height - 4));
  return {
    x: Math.floor((width - overlayWidth) / 2),
    y: Math.floor((height - overlayHeight) / 2),
    width: overlayWidth,
    height: overlayHeight
  };
}
