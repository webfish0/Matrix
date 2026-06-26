import readline from 'node:readline';
import { stdin as processInput, stdout as processOutput } from 'node:process';
import { posix } from 'node:path';
import { workspaceFile } from '../remote/ssh-workspace.mjs';
import { renderWorkbench } from '../tui/render.mjs';

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 30;

export class IdeSession {
  constructor({
    client,
    workspace,
    remoteLabel = 'ssh:fixture',
    inputReader = processInput,
    outputWriter = processOutput
  }) {
    this.client = client;
    this.workspace = workspace;
    this.remoteLabel = remoteLabel;
    this.input = inputReader;
    this.output = outputWriter;
    this.connection = 'connecting';
    this.mode = 'normal';
    this.focus = 'explorer';
    this.activeFile = null;
    this.bufferLines = [];
    this.cursor = { line: 0, column: 0 };
    this.dirty = false;
    this.explorerRows = [];
    this.expanded = new Set(['.']);
    this.selectedExplorerIndex = 0;
    this.lastSearch = [];
    this.lastTerminal = null;
    this.terminalInput = '';
    this.minibuffer = { kind: 'message', prompt: '', input: '', message: '' };
    this.overlay = null;
    this.pendingQuit = false;
    this.quitRequested = false;
    this.renderedFrames = [];
  }

  async initialize({ seedDemo = false } = {}) {
    this.connection = 'resolving workspace';
    await this.client.ensureWorkspace(this.workspace);
    if (seedDemo) {
      await this.client.writeFile(workspaceFile(this.workspace, 'src/app.ts'), 'export const message = "hello";\n');
      await this.client.writeFile(workspaceFile(this.workspace, 'README.md'), '# Smith MVP workspace\n');
      await this.client.writeFile(workspaceFile(this.workspace, 'package.json'), '{ "scripts": { "test": "echo ok" } }\n');
      this.expanded.add('src');
    }
    this.connection = 'ready';
    await this.refreshExplorer();
    const firstFile = this.explorerRows.find((row) => row.kind === 'file');
    if (firstFile) {
      this.selectedExplorerIndex = this.explorerRows.indexOf(firstFile);
      await this.open(firstFile.relativePath, { focusEditor: false });
    }
    this.setMessage('Ready. Press ? for help, Enter to open, i to edit.');
  }

  async runInteractive() {
    if (!this.input.isTTY || !this.output.isTTY) {
      await this.runLineFallback();
      return;
    }

    readline.emitKeypressEvents(this.input);
    this.input.setRawMode(true);
    this.output.write('\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[?25l');
    this.renderToTerminal();

    await new Promise((resolve) => {
      const onResize = () => this.renderToTerminal();
      const onData = async (chunk) => {
        const mouse = parseSgrMouse(chunk.toString('utf8'));
        if (mouse) {
          await this.handleMouse(mouse);
          this.renderToTerminal();
        }
      };
      const onKeypress = async (str, key) => {
        try {
          await this.handleKey(key, str);
          this.renderToTerminal();
          if (this.quitRequested) {
            cleanup();
            resolve();
          }
        } catch (error) {
          this.setMessage(friendlyError(error));
          this.renderToTerminal();
        }
      };
      const cleanup = () => {
        this.input.off('keypress', onKeypress);
        this.input.off('data', onData);
        this.output.off?.('resize', onResize);
        this.input.setRawMode(false);
        this.output.write('\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l');
      };
      this.input.on('keypress', onKeypress);
      this.input.on('data', onData);
      this.output.on?.('resize', onResize);
    });
  }

  async runUserScript(actions, { captureFrames = true } = {}) {
    this.renderSnapshot('initial', { captureFrames });
    for (const action of actions) {
      await this.performUserAction(action);
      this.renderSnapshot(labelForAction(action), { captureFrames });
      if (this.quitRequested) break;
    }
  }

  async performUserAction(action) {
    if (typeof action === 'string') {
      if (action.startsWith('text:')) {
        await this.handleText(action.slice('text:'.length));
        return;
      }
      if (action.startsWith('command:')) {
        await this.runPaletteCommand(action.slice('command:'.length));
        return;
      }
      await this.handleNamedKey(action);
      return;
    }
    if (action.type === 'mouse') {
      await this.handleMouse(action);
      return;
    }
    if (action.type === 'resize') {
      this.renderSnapshot(`resize ${action.width}x${action.height}`, {
        width: action.width,
        height: action.height,
        captureFrames: true
      });
      return;
    }
    throw new Error(`Unsupported user action: ${JSON.stringify(action)}`);
  }

  async handleKey(key, str = '') {
    if (key.ctrl && key.name === 'c') {
      await this.requestQuit();
      return;
    }
    if (key.ctrl && key.shift && key.name === 'p') {
      this.openCommandPalette();
      return;
    }
    if (key.ctrl && key.name === 'p') {
      this.openQuickOpen();
      return;
    }
    if (key.ctrl && key.name === 's') {
      await this.save();
      return;
    }
    if (key.ctrl && key.name === 'b') {
      this.focus = this.focus === 'explorer' ? 'editor' : 'explorer';
      this.setMessage(`Focus ${this.focus}`);
      return;
    }
    if (key.ctrl && key.name === 'j') {
      this.focus = 'panel';
      this.mode = 'terminal';
      this.setMessage('Terminal focus. Type a command and press Enter. Esc returns to Normal mode.');
      return;
    }
    if (key.ctrl && key.name === '`') {
      this.focus = 'panel';
      this.mode = 'terminal';
      return;
    }
    const name = keyName(key);
    if (!key.ctrl && !key.meta && str && str.length === 1 && !['return', 'enter', 'escape', 'backspace', 'tab'].includes(name)) {
      await this.handleText(str);
      return;
    }
    await this.handleNamedKey(name);
  }

  async handleNamedKey(name) {
    if (this.pendingQuit) {
      const handled = await this.handleQuitConfirmation(name);
      if (handled) return;
    }
    if (this.overlay) {
      await this.handleOverlayKey(name);
      return;
    }
    if (this.mode === 'insert') {
      await this.handleInsertKey(name);
      return;
    }
    if (this.mode === 'command' || this.mode === 'search') {
      await this.handleMinibufferKey(name);
      return;
    }
    if (this.mode === 'terminal') {
      await this.handleTerminalKey(name);
      return;
    }
    await this.handleNormalKey(name);
  }

  async handleNormalKey(name) {
    if (name === '?' || name === 'help') {
      this.overlay = {
        kind: 'help',
        title: `${titleCase(this.focus)} help`,
        lines: helpLines(this.focus)
      };
      return;
    }
    if (name === 'escape') {
      this.focus = 'editor';
      this.setMessage('Normal mode.');
      return;
    }
    if (name === 'tab') {
      this.focus = nextFocus(this.focus);
      this.setMessage(`Focus ${this.focus}`);
      return;
    }
    if (name === 'ctrl+shift+p') {
      this.openCommandPalette();
      return;
    }
    if (name === 'ctrl+p') {
      this.openQuickOpen();
      return;
    }
    if (name === 'ctrl+f' || name === '/') {
      this.openSearch();
      return;
    }
    if (name === 'ctrl+shift+f') {
      this.openSearch();
      return;
    }
    if (name === 'ctrl+s') {
      await this.save();
      return;
    }
    if (name === 'ctrl+`' || name === 'terminal') {
      this.mode = 'terminal';
      this.focus = 'panel';
      this.setMessage('Terminal mode. Type command, Enter runs, Esc returns.');
      return;
    }
    if (name === 'q') {
      await this.requestQuit();
      return;
    }
    if (this.focus === 'explorer') {
      await this.handleExplorerKey(name);
    } else if (this.focus === 'editor') {
      await this.handleEditorNormalKey(name);
    } else if (this.focus === 'panel') {
      this.mode = 'terminal';
    }
  }

  async handleExplorerKey(name) {
    if (name === 'down' || name === 'j') {
      this.selectedExplorerIndex = Math.min(this.explorerRows.length - 1, this.selectedExplorerIndex + 1);
      return;
    }
    if (name === 'up' || name === 'k') {
      this.selectedExplorerIndex = Math.max(0, this.selectedExplorerIndex - 1);
      return;
    }
    if (name === 'enter' || name === 'right' || name === 'space') {
      await this.activateExplorerSelection();
      return;
    }
    if (name === 'left') {
      const row = this.selectedExplorerRow();
      if (row?.kind === 'directory' && this.expanded.has(row.relativePath)) {
        this.expanded.delete(row.relativePath);
        await this.refreshExplorer();
      }
      return;
    }
    if (name === 'r') {
      await this.refreshExplorer();
      this.setMessage('Explorer refreshed.');
      return;
    }
    if (name === 'i') {
      this.focus = 'editor';
      this.mode = 'insert';
    }
  }

  async handleEditorNormalKey(name) {
    if (name === 'i') {
      this.mode = 'insert';
      this.setMessage('INSERT mode. Esc returns to NORMAL.');
      return;
    }
    if (name === 'h' || name === 'left') this.moveCursor(0, -1);
    if (name === 'l' || name === 'right') this.moveCursor(0, 1);
    if (name === 'j' || name === 'down') this.moveCursor(1, 0);
    if (name === 'k' || name === 'up') this.moveCursor(-1, 0);
  }

  async handleInsertKey(name) {
    if (name === 'escape') {
      this.mode = 'normal';
      this.setMessage('NORMAL mode.');
      return;
    }
    if (name === 'enter') {
      this.insertNewline();
      return;
    }
    if (name === 'backspace') {
      this.backspace();
      return;
    }
    if (name === 'ctrl+s') {
      await this.save();
    }
  }

  async handleText(text) {
    if (this.mode === 'terminal') {
      this.terminalInput += text;
      return;
    }
    if (this.mode === 'command' || this.mode === 'search') {
      this.minibuffer.input += text;
      return;
    }
    if (this.mode !== 'insert') {
      this.mode = 'insert';
      this.focus = 'editor';
    }
    this.insertText(text);
  }

  async handleMinibufferKey(name) {
    if (name === 'escape') {
      this.mode = 'normal';
      this.minibuffer = { kind: 'message', prompt: '', input: '', message: 'Cancelled.' };
      return;
    }
    if (name === 'backspace') {
      this.minibuffer.input = this.minibuffer.input.slice(0, -1);
      return;
    }
    if (name === 'enter') {
      if (this.mode === 'search') {
        await this.search(this.minibuffer.input);
      } else if (this.minibuffer.kind === 'quickOpen') {
        await this.quickOpen(this.minibuffer.input);
      } else {
        await this.runPaletteCommand(this.minibuffer.input);
      }
      this.mode = 'normal';
    }
  }

  async handleTerminalKey(name) {
    if (name === 'escape') {
      this.mode = 'normal';
      this.focus = 'editor';
      this.setMessage('Returned to editor.');
      return;
    }
    if (name === 'backspace') {
      this.terminalInput = this.terminalInput.slice(0, -1);
      return;
    }
    if (name === 'enter') {
      await this.runTerminalLine(this.terminalInput);
      this.terminalInput = '';
    }
  }

  async handleOverlayKey(name) {
    if (name === 'escape' || name === '?' || name === 'enter') {
      this.overlay = null;
      this.setMessage('Help closed.');
    }
  }

  async handleMouse({ x, y }) {
    const frame = this.renderFrame();
    const hit = frame.hitRegions
      .filter((region) => x >= region.rect.x && y >= region.rect.y && x < region.rect.x + region.rect.width && y < region.rect.y + region.rect.height)
      .sort((a, b) => b.z - a.z)[0];
    if (!hit) return;
    if (hit.id === 'primarySideBar') {
      this.focus = 'explorer';
      const rowIndex = y - frame.layout.regions.primarySideBar.y - 2;
      if (rowIndex >= 0 && rowIndex < this.explorerRows.length) {
        this.selectedExplorerIndex = rowIndex;
        await this.activateExplorerSelection();
      }
    } else if (hit.id === 'editor') {
      this.focus = 'editor';
      const editor = frame.layout.regions.editor;
      this.cursor.line = clamp(y - editor.y - 2, 0, Math.max(0, this.bufferLines.length - 1));
      this.cursor.column = clamp(x - editor.x - 6, 0, this.currentLine().length);
    } else if (hit.id === 'panel') {
      this.focus = 'panel';
      this.mode = 'terminal';
    }
  }

  async activateExplorerSelection() {
    const row = this.selectedExplorerRow();
    if (!row) return;
    if (row.kind === 'directory') {
      if (this.expanded.has(row.relativePath)) {
        this.expanded.delete(row.relativePath);
      } else {
        this.expanded.add(row.relativePath);
      }
      await this.refreshExplorer();
      return;
    }
    await this.open(row.relativePath, { focusEditor: true });
  }

  async open(relativePath, { focusEditor = true } = {}) {
    this.activeFile = relativePath;
    const text = await this.client.readFile(workspaceFile(this.workspace, relativePath));
    this.bufferLines = splitLines(text);
    this.cursor = { line: 0, column: 0 };
    this.dirty = false;
    if (focusEditor) this.focus = 'editor';
    this.setMessage(`Opened ${relativePath}`);
  }

  async quickOpen(query) {
    const match = this.explorerRows.find((row) => row.kind === 'file' && row.relativePath.includes(query));
    if (!match) {
      this.setMessage(`No file found for ${query}.`);
      return;
    }
    await this.open(match.relativePath, { focusEditor: true });
  }

  insertText(text) {
    if (!this.activeFile) throw new Error('No active file.');
    const line = this.currentLine();
    this.bufferLines[this.cursor.line] = `${line.slice(0, this.cursor.column)}${text}${line.slice(this.cursor.column)}`;
    this.cursor.column += text.length;
    this.dirty = true;
  }

  insertNewline() {
    const line = this.currentLine();
    const before = line.slice(0, this.cursor.column);
    const after = line.slice(this.cursor.column);
    this.bufferLines.splice(this.cursor.line, 1, before, after);
    this.cursor.line += 1;
    this.cursor.column = 0;
    this.dirty = true;
  }

  backspace() {
    if (this.cursor.column > 0) {
      const line = this.currentLine();
      this.bufferLines[this.cursor.line] = `${line.slice(0, this.cursor.column - 1)}${line.slice(this.cursor.column)}`;
      this.cursor.column -= 1;
      this.dirty = true;
      return;
    }
    if (this.cursor.line > 0) {
      const previous = this.bufferLines[this.cursor.line - 1];
      const current = this.currentLine();
      this.cursor.column = previous.length;
      this.bufferLines.splice(this.cursor.line - 1, 2, previous + current);
      this.cursor.line -= 1;
      this.dirty = true;
    }
  }

  moveCursor(lineDelta, columnDelta) {
    this.cursor.line = clamp(this.cursor.line + lineDelta, 0, Math.max(0, this.bufferLines.length - 1));
    this.cursor.column = clamp(this.cursor.column + columnDelta, 0, this.currentLine().length);
  }

  async save() {
    if (!this.activeFile) throw new Error('No active file.');
    await this.client.writeFile(workspaceFile(this.workspace, this.activeFile), `${this.bufferLines.join('\n')}${this.bufferLines.length ? '\n' : ''}`);
    this.dirty = false;
    this.setMessage(`Saved ${this.activeFile}`);
  }

  async search(query) {
    this.lastSearch = await this.client.search(this.workspace, query);
    this.focus = 'panel';
    this.setMessage(this.lastSearch.length === 0 ? `No results for ${query}.` : `${this.lastSearch.length} result(s) for ${query}.`);
  }

  async runTerminalLine(line) {
    const [command, ...args] = splitCommand(line);
    if (!command) return;
    this.lastTerminal = await this.client.runTerminalCommand(command, args);
    this.setMessage(`Command exited ${this.lastTerminal.status}.`);
  }

  openCommandPalette() {
    this.mode = 'command';
    this.focus = 'minibuffer';
    this.minibuffer = { kind: 'command', prompt: ':', input: '', message: 'Command palette: save, search, quick open, terminal, help, quit' };
  }

  openQuickOpen() {
    this.mode = 'command';
    this.focus = 'minibuffer';
    this.minibuffer = { kind: 'quickOpen', prompt: 'Open file:', input: '', message: 'Type part of a file path.' };
  }

  openSearch() {
    this.mode = 'search';
    this.focus = 'minibuffer';
    this.minibuffer = { kind: 'search', prompt: 'Search:', input: '', message: 'Workspace search.' };
  }

  async runPaletteCommand(commandText) {
    const command = commandText.trim().toLowerCase();
    if (command.includes('save')) {
      await this.save();
    } else if (command.includes('search')) {
      this.openSearch();
    } else if (command.includes('open')) {
      this.openQuickOpen();
    } else if (command.includes('terminal')) {
      this.mode = 'terminal';
      this.focus = 'panel';
    } else if (command.includes('help')) {
      this.overlay = { kind: 'help', title: 'Command help', lines: helpLines('global') };
    } else if (command.includes('quit')) {
      await this.requestQuit();
    } else {
      this.setMessage(`Unknown command: ${commandText || '<empty>'}`);
    }
  }

  async requestQuit() {
    if (this.dirty && !this.pendingQuit) {
      this.pendingQuit = true;
      this.overlay = {
        kind: 'confirm',
        title: 'Unsaved changes',
        lines: [
          `${this.activeFile} has unsaved changes.`,
          'Press s to save and quit, d to discard, Esc to cancel.'
        ]
      };
      return;
    }
    this.quitRequested = true;
    this.setMessage('Goodbye.');
  }

  async handleQuitConfirmation(name) {
    if (!this.pendingQuit) return false;
    if (name === 'escape') {
      this.pendingQuit = false;
      this.overlay = null;
      this.setMessage('Quit cancelled.');
      return true;
    }
    if (name === 's') {
      await this.save();
      this.quitRequested = true;
      return true;
    }
    if (name === 'd') {
      this.quitRequested = true;
      return true;
    }
    return true;
  }

  async refreshExplorer(relativePath = '.') {
    this.explorerRows = [];
    await this.addExplorerRows(relativePath, 0);
    this.selectedExplorerIndex = clamp(this.selectedExplorerIndex, 0, Math.max(0, this.explorerRows.length - 1));
  }

  async addExplorerRows(relativePath, depth) {
    const absolute = relativePath === '.' ? this.workspace : workspaceFile(this.workspace, relativePath);
    const entries = await this.client.list(absolute);
    for (const entry of entries) {
      const childPath = relativePath === '.' ? entry.name : posix.join(relativePath, entry.name);
      const row = {
        kind: entry.kind,
        name: entry.name,
        relativePath: childPath,
        depth,
        expanded: this.expanded.has(childPath)
      };
      this.explorerRows.push(row);
      if (entry.kind === 'directory' && this.expanded.has(childPath)) {
        await this.addExplorerRows(childPath, depth + 1);
      }
    }
  }

  selectedExplorerRow() {
    return this.explorerRows[this.selectedExplorerIndex] ?? null;
  }

  currentLine() {
    if (this.bufferLines.length === 0) this.bufferLines.push('');
    return this.bufferLines[this.cursor.line] ?? '';
  }

  setMessage(message) {
    this.minibuffer = { kind: 'message', prompt: '', input: '', message };
  }

  renderFrame({ width = terminalWidth(this.output), height = terminalHeight(this.output) } = {}) {
    return renderWorkbench({
      width,
      height,
      state: this.renderState()
    });
  }

  renderState() {
    return {
      workspace: this.workspace,
      remote: this.remoteLabel,
      connection: this.connection,
      mode: this.mode.toUpperCase(),
      focus: this.focus,
      activeFile: this.activeFile ?? 'No file',
      unsaved: this.dirty ? 1 : 0,
      dirty: this.dirty,
      branch: 'main',
      cursorLine: this.cursor.line + 1,
      cursorColumn: this.cursor.column + 1,
      explorerRows: this.explorerRows.map((row, index) => ({
        ...row,
        selected: index === this.selectedExplorerIndex,
        active: row.relativePath === this.activeFile
      })),
      editorLines: this.bufferLines.map((line, index) => ({
        number: index + 1,
        text: line,
        cursor: index === this.cursor.line,
        cursorColumn: index === this.cursor.line ? this.cursor.column : null
      })),
      minibuffer: this.minibuffer,
      overlay: this.overlay,
      searchResults: this.lastSearch,
      terminal: {
        input: this.terminalInput,
        last: this.lastTerminal
      }
    };
  }

  renderToTerminal() {
    const frame = this.renderFrame();
    this.output.write(`\x1b[H${frame.text}`);
  }

  renderSnapshot(label, { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, captureFrames = true } = {}) {
    const frame = this.renderFrame({ width, height });
    if (captureFrames) {
      this.renderedFrames.push({ label, width, height, text: frame.text });
    }
    this.output.write(`\n--- ${label} ---\n${frame.text}\n`);
  }

  async runLineFallback() {
    this.output.write('Smith terminal IDE requires an interactive TTY for full-screen mode.\n');
    this.output.write('Use npm run smith -- ide-demo from a terminal.\n');
    this.renderSnapshot('non-tty preview');
  }

  // Backward-compatible command script support for older smoke tests.
  async runScript(lines) {
    const translated = [];
    for (const line of lines) {
      const [command, ...args] = splitCommand(line);
      if (command === 'ls') translated.push('tab');
      if (command === 'open') {
        this.openQuickOpen();
        await this.handleText(args[0] ?? '');
        await this.handleMinibufferKey('enter');
      }
      if (command === 'replace') {
        this.focus = 'editor';
        this.mode = 'insert';
        this.insertText(args.slice(1).join(' '));
      }
      if (command === 'save') await this.save();
      if (command === 'search') await this.search(args.join(' '));
      if (command === 'run') await this.runTerminalLine(args.join(' '));
      if (command === 'status') this.setMessage(`remote=${this.remoteLabel} workspace=${this.workspace}`);
      if (command === 'quit') await this.requestQuit();
    }
    this.renderSnapshot('legacy script');
    return translated;
  }
}

function keyName(key) {
  if (!key) return '';
  if (key.ctrl && key.shift && key.name) return `ctrl+shift+${key.name}`;
  if (key.ctrl && key.name) return `ctrl+${key.name}`;
  return key.name ?? key.sequence ?? '';
}

function splitLines(text) {
  const withoutFinal = text.endsWith('\n') ? text.slice(0, -1) : text;
  return withoutFinal.split(/\r?\n/u);
}

function splitCommand(line) {
  const parts = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/gu;
  for (const match of line.matchAll(pattern)) {
    parts.push(match[1] ?? match[2] ?? match[3]);
  }
  return parts;
}

function labelForAction(action) {
  if (typeof action === 'string') return action.startsWith('text:') ? 'typed text' : action;
  if (action.type === 'mouse') return `mouse ${action.x},${action.y}`;
  if (action.type === 'resize') return `resize ${action.width}x${action.height}`;
  return 'action';
}

function helpLines(focus) {
  const global = [
    'Global: Ctrl+Shift+P commands, Ctrl+P quick open, Ctrl+S save, Ctrl+` terminal, ? help, q quit.',
    'Modes: NORMAL navigates, INSERT edits, SEARCH finds text, TERMINAL runs remote commands.'
  ];
  if (focus === 'explorer') return ['Explorer: ↑/↓ or j/k move, Enter opens/toggles, r refresh, Tab changes focus.', ...global];
  if (focus === 'editor') return ['Editor: i insert, Esc normal, h/j/k/l move, / search, Ctrl+S save.', ...global];
  if (focus === 'panel') return ['Terminal: type command, Enter runs remotely, Esc returns to editor.', ...global];
  return global;
}

function nextFocus(focus) {
  const order = ['explorer', 'editor', 'panel'];
  return order[(order.indexOf(focus) + 1) % order.length] ?? 'editor';
}

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function terminalWidth(output) {
  return output.columns && output.columns > 0 ? output.columns : DEFAULT_WIDTH;
}

function terminalHeight(output) {
  return output.rows && output.rows > 0 ? output.rows : DEFAULT_HEIGHT;
}

function parseSgrMouse(sequence) {
  const match = /\x1b\[<(\d+);(\d+);(\d+)([mM])/u.exec(sequence);
  if (!match || match[4] === 'm') return null;
  return {
    button: Number(match[1]),
    x: Number(match[2]) - 1,
    y: Number(match[3]) - 1
  };
}

function friendlyError(error) {
  const message = error?.message ?? String(error);
  if (message.includes('ENOENT')) return 'File not found. Refresh Explorer or search by name.';
  if (message.includes('EACCES')) return 'Permission denied. Check remote file permissions.';
  if (message.includes('Command failed: ssh')) return 'Remote command failed. Check SSH connection and remote command.';
  return `Error: ${message}`;
}
