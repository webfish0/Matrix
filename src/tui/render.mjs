import { computeLayout, rect } from './layout.mjs';

export function renderWorkbench({ width, height, state = {} }) {
  const layout = computeLayout({ width, height });
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));
  const hitRegions = [];

  if (layout.mode === 'minimum') {
    writeText(cells, 1, 1, 'Smith needs more space');
    writeText(cells, 1, 2, 'Smith needs at least 60x14 cells.');
    writeText(cells, 1, 3, `Current: ${width}x${height}`);
    writeText(cells, 1, 5, `Connection: ${state.connection ?? 'unknown'}`);
    writeText(cells, 1, 6, `Unsaved files: ${state.unsaved ? state.activeFile : 'none'}`);
    writeText(cells, 1, 8, 'Resize terminal or press Ctrl+C to exit safely.');
    hitRegions.push(region('message', layout.regions.message, 0, ['focus']));
    return frame(layout, cells, hitRegions);
  }

  const { regions } = layout;
  drawTitle(cells, regions.title, state);
  hitRegions.push(region('title', regions.title, 10, ['focus', 'menu']));

  if (regions.activity.width > 0) {
    drawActivity(cells, regions.activity, state);
    hitRegions.push(region('activity', regions.activity, 10, ['click', 'wheel', 'context']));
  }

  if (regions.primarySideBar.width > 0) {
    drawExplorer(cells, regions.primarySideBar, state);
    hitRegions.push(region('primarySideBar', regions.primarySideBar, 10, ['click', 'wheel', 'context']));
  }

  drawEditor(cells, regions.editor, state);
  hitRegions.push(region('editor', regions.editor, 10, ['click', 'drag', 'wheel', 'context']));

  if (regions.secondarySideBar.width > 0) {
    drawAuxiliary(cells, regions.secondarySideBar, state);
    hitRegions.push(region('secondarySideBar', regions.secondarySideBar, 10, ['click', 'wheel']));
  }

  if (regions.panel.height > 0) {
    drawPanel(cells, regions.panel, state);
    hitRegions.push(region('panel', regions.panel, 10, ['click', 'drag', 'wheel', 'context']));
  }

  drawMinibuffer(cells, regions.status.y - 1, width, state);
  drawStatus(cells, regions.status, state);
  hitRegions.push(region('status', regions.status, 10, ['click']));

  if (state.minibuffer?.kind === 'command') {
    const commandPalette = drawCommandPalette(cells, width, regions.status.y - 1, state.minibuffer);
    hitRegions.push(region('overlay.commandPalette', commandPalette, 25, ['click', 'wheel', 'escape']));
  }

  if (layout.mode === 'narrow') {
    const narrowHint = drawNarrowHint(cells, width, height);
    hitRegions.push(region('overlay.commandHint', narrowHint, 30, ['click', 'escape']));
  }

  if (state.overlay) {
    const overlay = centered(width, height, Math.min(72, width - 4), Math.min(12, height - 4));
    drawBox(cells, overlay, state.overlay.title ?? 'Overlay', true);
    const lines = state.overlay.lines ?? [];
    lines.slice(0, overlay.height - 2).forEach((line, index) => {
      writeText(cells, overlay.x + 2, overlay.y + 1 + index, truncate(line, overlay.width - 4));
    });
    hitRegions.push(region(`overlay.${state.overlay.kind ?? 'generic'}`, overlay, 30, ['click', 'escape']));
  }

  return frame(layout, cells, hitRegions);
}

export function routePointer(hitRegions, { x, y }) {
  return hitRegions
    .filter((candidate) => contains(candidate.rect, x, y))
    .sort((a, b) => b.z - a.z)[0] ?? null;
}

function drawTitle(cells, area, state) {
  fillRegion(cells, area, '─');
  const dirty = state.dirty ? ' ●' : '';
  const title = ` Smith ${state.remote ?? 'local'} ${state.connection ?? 'unknown'}  ${state.workspace ?? ''}  ${state.activeFile ?? 'No file'}${dirty} `;
  writeText(cells, 1, area.y, truncate(title, area.width - 2));
  if (area.height > 1) {
    writeText(cells, 1, area.y + 1, truncate(` Focus: ${state.focus ?? 'editor'}   Help: ?   Commands: F1 or :   Quick open: Ctrl+P   Terminal: F2 `, area.width - 2));
  }
}

function drawActivity(cells, area, state) {
  drawBox(cells, area, '');
  const items = [
    ['E', state.focus === 'explorer'],
    ['S', false],
    ['G', false],
    ['T', state.focus === 'panel'],
    ['?', Boolean(state.overlay)]
  ];
  items.forEach(([label, active], index) => {
    writeText(cells, area.x + 1, area.y + 1 + index, active ? String(label) : String(label).toLowerCase());
  });
}

function drawExplorer(cells, area, state) {
  drawBox(cells, area, focusTitle('Explorer', state.focus === 'explorer'));
  writeText(cells, area.x + 1, area.y + 1, truncate('Enter open/toggle  ? help', area.width - 2));
  const rows = state.explorerRows ?? [];
  rows.slice(0, Math.max(0, area.height - 3)).forEach((row, index) => {
    const marker = row.selected ? '▸' : ' ';
    const type = row.kind === 'directory' ? (row.expanded ? '▾' : '▸') : ' ';
    const dirty = row.active && state.dirty ? ' ●' : row.active ? ' •' : '';
    const indent = ' '.repeat(Math.min(8, row.depth * 2));
    writeText(cells, area.x + 1, area.y + 2 + index, truncate(`${marker}${indent}${type} ${row.name}${dirty}`, area.width - 2));
  });
  if (rows.length === 0) {
    writeText(cells, area.x + 1, area.y + 2, '<empty workspace>');
  }
}

function drawEditor(cells, area, state) {
  const title = focusTitle(`Editor: ${state.activeFile ?? 'No file'}${state.dirty ? ' ●' : ''}`, state.focus === 'editor');
  drawBox(cells, area, title);
  const lines = state.editorLines ?? [];
  const visibleRows = Math.max(0, area.height - 3);
  if (lines.length === 0) {
    writeText(cells, area.x + 2, area.y + 2, 'No file open. Use Explorer or Ctrl+P.');
  }
  lines.slice(0, visibleRows).forEach((line, index) => {
    const lineNumber = String(line.number).padStart(3, ' ');
    const prefix = line.cursor && state.focus === 'editor' ? '>' : ' ';
    const cursorText = line.cursor ? withCursor(line.text, line.cursorColumn ?? 0, state.mode) : line.text;
    writeText(cells, area.x + 1, area.y + 1 + index, truncate(`${prefix}${lineNumber} ${cursorText}`, area.width - 2));
  });
  const footer = `${state.mode ?? 'NORMAL'}  ${state.dirty ? 'Unsaved changes' : 'Saved'}  i to edit  Esc normal  Ctrl+S save  / search`;
  writeText(cells, area.x + 1, area.y + area.height - 2, truncate(footer, area.width - 2));
}

function drawAuxiliary(cells, area, state) {
  drawBox(cells, area, 'Problems');
  const resultCount = state.searchResults?.length ?? 0;
  writeText(cells, area.x + 1, area.y + 1, `Problems: 0`);
  writeText(cells, area.x + 1, area.y + 2, `Search: ${resultCount}`);
  writeText(cells, area.x + 1, area.y + 3, `Branch: ${state.branch ?? 'main'}`);
}

function drawPanel(cells, area, state) {
  drawBox(cells, area, focusTitle('Panel', state.focus === 'panel'));
  const terminal = state.terminal ?? {};
  const searchResults = state.searchResults ?? [];
  let lines = [];
  const showingSearch = searchResults.length > 0 && state.focus === 'panel' && state.mode !== 'TERMINAL';
  if (showingSearch) {
    lines.push(`Search results (${searchResults.length})  ↑/↓ select  Enter open`);
    lines.push(...searchResults.map((result, index) => `${index === (state.selectedSearchIndex ?? 0) ? '▸' : ' '} ${result.relativePath}:${result.line}:${result.column} ${result.preview}`));
  } else if (state.focus === 'panel' && state.mode === 'TERMINAL' && (!terminal.last || terminal.input)) {
    lines.push(`$ ${terminal.input ?? ''}  [cwd ${terminal.cwd ?? state.workspace ?? ''}]`);
  } else if (terminal.last) {
    lines.push(`$ ${terminal.last.command}  [cwd ${terminal.cwd ?? state.workspace ?? ''}]`);
    if (terminal.last.stdout) lines.push(...terminal.last.stdout.trimEnd().split(/\r?\n/u));
    if (terminal.last.stderr) lines.push(...terminal.last.stderr.trimEnd().split(/\r?\n/u));
    lines.push(`exit ${terminal.last.status}`);
  }
  if (lines.length === 0) {
    lines = ['Terminal: F2 then type command', `cwd: ${terminal.cwd ?? state.workspace ?? ''}`, 'Search: /'];
  }
  lines.slice(0, Math.max(0, area.height - 2)).forEach((line, index) => {
    writeText(cells, area.x + 1, area.y + 1 + index, truncate(line, area.width - 2));
  });
}

function drawCommandPalette(cells, width, minibufferY, minibuffer) {
  const itemCount = Math.min(4, Math.max(1, minibuffer.items?.length ?? 0));
  const area = rect(2, Math.max(2, minibufferY - itemCount - 2), Math.min(78, width - 4), itemCount + 2);
  drawBox(cells, area, 'Command palette', true);
  const items = minibuffer.items ?? [];
  if (items.length === 0) {
    writeText(cells, area.x + 2, area.y + 1, truncate(minibuffer.message ?? 'No matching commands.', area.width - 4));
    return area;
  }
  const selectedIndex = minibuffer.selectedIndex ?? 0;
  const start = Math.max(0, Math.min(selectedIndex, items.length - itemCount));
  items.slice(start, start + itemCount).forEach((item, index) => {
    const selected = start + index === selectedIndex ? '▸' : ' ';
    const status = item.enabled ? '' : ` — disabled: ${item.reason}`;
    const recent = item.recent ? ' recent' : '';
    writeText(
      cells,
      area.x + 1,
      area.y + 1 + index,
      truncate(`${selected} ${item.label}  ${item.shortcut}${recent}${status}`, area.width - 2)
    );
  });
  return area;
}

function drawMinibuffer(cells, y, width, state) {
  if (y < 0) return;
  fillRegion(cells, rect(0, y, width, 1), ' ');
  const minibuffer = state.minibuffer ?? {};
  const prompt = minibuffer.message?.startsWith('Disabled:')
    ? minibuffer.message
    : minibuffer.prompt
      ? `${minibuffer.prompt} ${minibuffer.input ?? ''}`
      : minibuffer.message ?? '';
  writeText(cells, 0, y, truncate(prompt, width));
}

function drawStatus(cells, area, state) {
  fillRegion(cells, area, ' ');
  const dirty = state.dirty ? '●' : '✓';
  const status = `${state.mode ?? 'NORMAL'}  SSH ${state.connection ?? 'unknown'}  ${state.branch ?? 'main'}  ${state.activeFile ?? 'No file'} ${dirty}  Ln ${state.cursorLine ?? 1} Col ${state.cursorColumn ?? 1}  Problems 0  ? Help  F1 commands  q quit`;
  writeText(cells, 0, area.y, truncate(status, area.width));
}

function drawNarrowHint(cells, width, height) {
  const overlay = centered(width, height, 48, 6);
  drawBox(cells, overlay, 'Narrow layout', true);
  writeText(cells, overlay.x + 1, overlay.y + 1, 'Explorer/Search/Terminal open as overlays.');
  writeText(cells, overlay.x + 1, overlay.y + 2, 'Editor state is preserved.');
  return overlay;
}

function withCursor(text, column, mode) {
  const safeColumn = Math.min(Math.max(0, column), text.length);
  const marker = mode === 'INSERT' ? '▏' : '█';
  return `${text.slice(0, safeColumn)}${marker}${text.slice(safeColumn)}`;
}

function focusTitle(title, focused) {
  return focused ? `▌ ${title}` : title;
}

function frame(layout, cells, hitRegions) {
  return {
    layout,
    text: cells.map((row) => row.join('')).join('\n'),
    rows: cells.map((row) => row.join('')),
    hitRegions
  };
}

function drawBox(cells, area, title, heavy = false) {
  if (area.width <= 0 || area.height <= 0) return;
  const chars = heavy
    ? { horizontal: '━', vertical: '┃', topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛' }
    : { horizontal: '─', vertical: '│', topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘' };
  const right = area.x + area.width - 1;
  const bottom = area.y + area.height - 1;
  for (let x = area.x; x <= right; x++) {
    setCell(cells, x, area.y, chars.horizontal);
    setCell(cells, x, bottom, chars.horizontal);
  }
  for (let y = area.y; y <= bottom; y++) {
    setCell(cells, area.x, y, chars.vertical);
    setCell(cells, right, y, chars.vertical);
  }
  setCell(cells, area.x, area.y, chars.topLeft);
  setCell(cells, right, area.y, chars.topRight);
  setCell(cells, area.x, bottom, chars.bottomLeft);
  setCell(cells, right, bottom, chars.bottomRight);
  if (title) writeText(cells, area.x + 1, area.y, ` ${truncate(title, Math.max(0, area.width - 4))} `);
}

function fillRegion(cells, area, char) {
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      setCell(cells, x, y, char);
    }
  }
}

function writeText(cells, x, y, text) {
  const safeText = String(text ?? '');
  for (let index = 0; index < safeText.length; index++) {
    setCell(cells, x + index, y, safeText[index]);
  }
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

function truncate(value, width) {
  const text = String(value ?? '');
  if (width <= 0) return '';
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}
