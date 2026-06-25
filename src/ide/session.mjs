import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { workspaceFile } from '../remote/ssh-workspace.mjs';
import { renderWorkbench } from '../tui/render.mjs';

export class IdeSession {
  constructor({ client, workspace, remoteLabel = 'ssh:fixture', outputWriter = output }) {
    this.client = client;
    this.workspace = workspace;
    this.remoteLabel = remoteLabel;
    this.output = outputWriter;
    this.activeFile = null;
    this.buffer = '';
    this.dirty = false;
    this.lastSearch = [];
    this.lastTerminal = null;
  }

  async initialize() {
    await this.client.ensureWorkspace(this.workspace);
    await this.client.writeFile(workspaceFile(this.workspace, 'src/app.ts'), 'export const message = "hello";\n');
    await this.client.writeFile(workspaceFile(this.workspace, 'README.md'), '# Smith MVP workspace\n');
    await this.open('src/app.ts');
  }

  async runInteractive() {
    this.printWelcome();
    const rl = readline.createInterface({ input, output: this.output, terminal: true });
    try {
      while (true) {
        const line = await rl.question('smith> ');
        const shouldContinue = await this.execute(line);
        if (!shouldContinue) {
          break;
        }
      }
    } finally {
      rl.close();
    }
  }

  async runScript(lines) {
    this.printWelcome();
    for (const line of lines) {
      this.write(`smith> ${line}\n`);
      const shouldContinue = await this.execute(line);
      if (!shouldContinue) {
        break;
      }
    }
  }

  async execute(line) {
    const [command, ...args] = splitCommand(line);
    if (!command) return true;
    if (command === 'help') {
      this.printHelp();
    } else if (command === 'frame') {
      this.printFrame();
    } else if (command === 'ls') {
      await this.printExplorer();
    } else if (command === 'open') {
      await this.open(requiredArg(args, 'open <file>'));
      this.printEditor();
    } else if (command === 'show') {
      this.printEditor();
    } else if (command === 'replace') {
      this.replace(requiredArg(args, 'replace <old> <new>'), args.slice(1).join(' '));
      this.printEditor();
    } else if (command === 'set') {
      this.buffer = args.join(' ');
      this.dirty = true;
      this.printEditor();
    } else if (command === 'save') {
      await this.save();
    } else if (command === 'search') {
      await this.search(requiredArg(args, 'search <query>'));
    } else if (command === 'run') {
      await this.runTerminal(requiredArg(args, 'run <command> [args...]'), args.slice(1));
    } else if (command === 'status') {
      this.printStatus();
    } else if (command === 'quit' || command === 'exit') {
      if (this.dirty) {
        this.write('Unsaved changes exist. Run `save` first or `quit!` to discard.\n');
        return true;
      }
      this.write('Goodbye.\n');
      return false;
    } else if (command === 'quit!') {
      this.write('Discarded unsaved changes. Goodbye.\n');
      return false;
    } else {
      this.write(`Unknown command: ${command}. Run help.\n`);
    }
    return true;
  }

  async open(relativePath) {
    this.activeFile = relativePath;
    this.buffer = await this.client.readFile(workspaceFile(this.workspace, relativePath));
    this.dirty = false;
  }

  replace(oldText, newText) {
    if (!this.activeFile) throw new Error('No active file. Run open <file>.');
    this.buffer = this.buffer.replace(oldText, newText);
    this.dirty = true;
  }

  async save() {
    if (!this.activeFile) throw new Error('No active file. Run open <file>.');
    await this.client.writeFile(workspaceFile(this.workspace, this.activeFile), this.buffer);
    this.dirty = false;
    this.write(`Saved ${this.activeFile}\n`);
  }

  async search(query) {
    this.lastSearch = await this.client.search(this.workspace, query);
    if (this.lastSearch.length === 0) {
      this.write(`No results for ${query}\n`);
      return;
    }
    for (const result of this.lastSearch) {
      this.write(`${result.relativePath}:${result.line}:${result.column} ${result.preview}\n`);
    }
  }

  async runTerminal(command, args) {
    this.lastTerminal = await this.client.runTerminalCommand(command, args);
    this.write(`exit ${this.lastTerminal.status}\n`);
    if (this.lastTerminal.stdout) this.write(this.lastTerminal.stdout);
    if (this.lastTerminal.stderr) this.write(this.lastTerminal.stderr);
  }

  async printExplorer() {
    const entries = await this.client.list(this.workspace);
    this.write('Explorer\n');
    for (const entry of entries) {
      this.write(`${entry.kind === 'directory' ? '▾' : ' '} ${entry.name}\n`);
    }
  }

  printEditor() {
    this.write(`Editor: ${this.activeFile}${this.dirty ? ' ●' : ''}\n`);
    const lines = this.buffer.split(/\r?\n/u);
    lines.slice(0, 20).forEach((line, index) => {
      this.write(`${String(index + 1).padStart(3, ' ')} ${line}\n`);
    });
  }

  printFrame() {
    const frame = renderWorkbench({
      width: 100,
      height: 30,
      state: {
        workspace: `${this.remoteLabel}:${this.workspace}`,
        remote: this.remoteLabel,
        connection: 'ready',
        activeFile: this.activeFile ?? 'none',
        unsaved: this.dirty ? 1 : 0
      }
    });
    this.write(`${frame.text}\n`);
  }

  printStatus() {
    this.write(`remote=${this.remoteLabel} workspace=${this.workspace} active=${this.activeFile ?? 'none'} dirty=${this.dirty}\n`);
  }

  printWelcome() {
    this.write('Smith Product MVP interactive IDE\n');
    this.write('Connected over SSH. Language extensions are deferred after MVP.\n');
    this.printHelp();
    this.printFrame();
  }

  printHelp() {
    this.write('Commands: frame, ls, open <file>, show, replace <old> <new>, set <text>, save, search <query>, run <cmd> [args], status, quit\n');
  }

  write(text) {
    this.output.write(text);
  }
}

function splitCommand(line) {
  const parts = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/gu;
  for (const match of line.matchAll(pattern)) {
    parts.push(match[1] ?? match[2] ?? match[3]);
  }
  return parts;
}

function requiredArg(args, usage) {
  if (!args[0]) {
    throw new Error(`Usage: ${usage}`);
  }
  return args[0];
}
