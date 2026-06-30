export const TERMINAL_ENTER_SEQUENCE = '\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[?25l';
export const TERMINAL_RESTORE_SEQUENCE = '\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l';

export class TerminalLifecycle {
  constructor({ input, output }) {
    this.input = input;
    this.output = output;
    this.active = false;
    this.rawModeEnabled = false;
  }

  enter() {
    if (this.active) return false;
    this.active = true;
    this.input.setRawMode(true);
    this.rawModeEnabled = true;
    this.input.resume?.();
    this.output.write(TERMINAL_ENTER_SEQUENCE);
    return true;
  }

  restore() {
    if (!this.active) return false;
    this.active = false;
    try {
      if (this.rawModeEnabled) {
        this.input.setRawMode(false);
        this.rawModeEnabled = false;
      }
    } finally {
      this.input.pause?.();
      this.output.write(TERMINAL_RESTORE_SEQUENCE);
    }
    return true;
  }
}

export function terminalCapabilities({ input, output, env = process.env } = {}) {
  const term = String(env.TERM ?? 'unknown');
  const colorTerm = String(env.COLORTERM ?? '');
  const conservative = !input?.isTTY || !output?.isTTY || term === 'dumb' || term === 'unknown';
  return {
    schema: 'smith.terminal-capabilities.v1',
    profile: conservative ? 'conservative' : 'interactive',
    term,
    color: colorTerm.toLowerCase().includes('truecolor') || colorTerm.toLowerCase().includes('24bit')
      ? 'truecolor'
      : term.includes('256color')
        ? '256'
        : '16',
    unicode: env.LC_ALL !== 'C' && env.LANG !== 'C',
    sgrMouse: !conservative,
    alternateScreen: !conservative,
    bracketedPaste: false,
    focusEvents: false,
    keyboardProtocol: 'legacy'
  };
}

export function signalExitCode(signal) {
  return {
    SIGHUP: 129,
    SIGINT: 130,
    SIGTERM: 143
  }[signal] ?? 1;
}
