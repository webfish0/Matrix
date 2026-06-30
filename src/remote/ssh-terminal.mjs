import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { TerminalScreen } from '../tui/terminal-screen.mjs';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_OUTPUT_LIMIT = 2 * 1024 * 1024;

export class SshTerminalSession extends EventEmitter {
  constructor({
    target,
    workspace,
    width = 80,
    height = 24,
    outputLimit = DEFAULT_OUTPUT_LIMIT
  }) {
    super();
    this.target = target;
    this.workspace = workspace;
    this.width = width;
    this.height = height;
    this.outputLimit = outputLimit;
    this.screen = new TerminalScreen({ width, height, scrollbackLimit: 2000 });
    this.child = null;
    this.pending = null;
    this.commandChain = Promise.resolve();
    this.closed = false;
    this.exit = null;
  }

  async start() {
    if (this.child) return;
    const remote = this.target.user ? `${this.target.user}@${this.target.host}` : this.target.host;
    const remoteCommand = [
      `stty -echo cols ${positiveInteger(this.width)} rows ${positiveInteger(this.height)}`,
      `cd ${shellQuote(this.workspace)}`,
      "export PS1='' PS2=''; exec /bin/sh -i"
    ].join(' && ');
    const args = [
      '-tt',
      '-p',
      String(this.target.port),
      '-i',
      this.target.identityFile,
      '-o',
      'BatchMode=yes',
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      `UserKnownHostsFile=${this.target.knownHostsFile}`,
      ...(this.target.extraOptions ?? []),
      remote,
      remoteCommand
    ];
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    child.stdout.on('data', (chunk) => this.acceptOutput(chunk));
    child.stderr.on('data', (chunk) => this.acceptOutput(chunk));
    this.exit = new Promise((resolve) => {
      child.once('exit', (code, signal) => {
        this.closed = true;
        if (this.pending) {
          clearTimeout(this.pending.timer);
          this.pending.reject(new Error(`Remote terminal exited before command completed (${signal ?? code ?? 'unknown'}).`));
          this.pending = null;
        }
        this.emit('exit', { code, signal });
        resolve({ code, signal });
      });
    });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  }

  async runCommand(line, { timeout = DEFAULT_TIMEOUT } = {}) {
    const command = String(line ?? '').trim();
    if (!command) return { command: '', status: 0, stdout: '', stderr: '' };
    const operation = this.commandChain.then(() => this.runCommandNow(command, timeout));
    this.commandChain = operation.catch(() => {});
    return operation;
  }

  async runCommandNow(command, timeout) {
    await this.start();
    if (this.closed || !this.child?.stdin.writable) {
      throw new Error('Remote terminal is closed.');
    }
    const marker = `__SMITH_EXIT_${randomUUID().replaceAll('-', '')}__`;
    const completion = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.marker === marker) this.pending = null;
        reject(new Error(`Remote terminal command timed out after ${timeout} ms.`));
      }, timeout);
      timer.unref?.();
      this.pending = { marker, command, buffer: '', resolve, reject, timer };
    });
    this.child.stdin.write(`${command}\nprintf '\\n${marker}:%s\\n' "$?"\n`);
    return completion;
  }

  acceptOutput(chunk) {
    const text = chunk.toString('utf8');
    if (!this.pending) {
      this.screen.write(text);
      this.emit('output', text);
      return;
    }
    this.pending.buffer = boundedAppend(this.pending.buffer, text, this.outputLimit);
    const pattern = new RegExp(`(?:^|\\r?\\n)${this.pending.marker}:(\\d+)\\r?\\n`, 'u');
    const match = pattern.exec(this.pending.buffer);
    if (!match) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    const stdout = cleanCommandOutput(
      pending.buffer.slice(0, match.index),
      pending.command,
      pending.marker
    );
    if (stdout) {
      this.screen.write(`${stdout}\n`);
      this.emit('output', stdout);
    }
    pending.resolve({
      command: pending.command,
      status: Number(match[1]),
      stdout,
      stderr: ''
    });
  }

  async resize({ width, height }) {
    this.width = positiveInteger(width);
    this.height = positiveInteger(height);
    this.screen.resize({ width: this.width, height: this.height });
    if (!this.child || this.closed) return;
    await this.runCommand(`stty cols ${this.width} rows ${this.height}`);
  }

  snapshot() {
    return this.screen.snapshot();
  }

  async close({ timeout = 3000 } = {}) {
    if (!this.child || this.closed) return this.exit;
    if (this.child.stdin.writable) {
      this.child.stdin.write('exit\n');
      this.child.stdin.end();
    }
    const timer = new Promise((resolve) => {
      const handle = setTimeout(() => resolve({ timeout: true }), timeout);
      handle.unref?.();
    });
    const result = await Promise.race([this.exit, timer]);
    if (result?.timeout && !this.closed) {
      this.child.kill('SIGTERM');
      return this.exit;
    }
    return result;
  }
}

function boundedAppend(current, addition, limit) {
  const combined = current + addition;
  return combined.length <= limit ? combined : combined.slice(-limit);
}

function cleanCommandOutput(raw, command, marker) {
  return String(raw)
    .replace(/\r/gu, '')
    .split('\n')
    .map((line) => line.replace(/^.*(?:[$#%])\s+/u, ''))
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed
        && trimmed !== command
        && !trimmed.includes(marker)
        && !trimmed.startsWith("printf '\\n__SMITH_EXIT_");
    })
    .join('\n')
    .trim();
}

function positiveInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@%+-]+$/u.test(text)) return text;
  return `'${text.replaceAll("'", "'\\''")}'`;
}
