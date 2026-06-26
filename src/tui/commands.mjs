export const defaultKeybindings = {
  f1: 'workbench.action.showCommands',
  ':': 'workbench.action.showCommands',
  'ctrl+p': 'workbench.action.quickOpen',
  'ctrl+shift+p': 'workbench.action.showCommands',
  f2: 'workbench.action.terminal.toggleTerminal',
  'ctrl+`': 'workbench.action.terminal.toggleTerminal',
  'ctrl+b': 'workbench.action.toggleSidebarVisibility',
  'ctrl+j': 'workbench.action.togglePanel',
  f6: 'workbench.action.focusNextPart',
  'shift+f6': 'workbench.action.focusPreviousPart'
};

export function resolveKeybinding(key, context = {}) {
  const command = defaultKeybindings[key.toLowerCase()] ?? null;
  if (!command) {
    return { command: null, enabled: false, reason: 'unbound' };
  }
  if (context.terminalFocus && command !== 'workbench.action.terminal.toggleTerminal') {
    return { command, enabled: false, reason: 'terminal focus captures this keybinding' };
  }
  return { command, enabled: true, reason: 'enabled' };
}

export function normalizeTerminalKey(key = {}, str = '') {
  const name = normalizeKeyName(key.name ?? key.sequence ?? str ?? '');
  if (key.ctrl && key.shift && name) return `ctrl+shift+${name}`;
  if (key.ctrl && name) return `ctrl+${name}`;
  if (key.shift && name && name.startsWith('f')) return `shift+${name}`;
  if (str === ':') return ':';
  return name;
}

function normalizeKeyName(name) {
  const normalized = String(name ?? '').toLowerCase();
  if (normalized === 'return') return 'enter';
  if (normalized === '\r' || normalized === '\n') return 'enter';
  if (normalized === '\u001b') return 'escape';
  if (normalized === '\t') return 'tab';
  return normalized;
}
