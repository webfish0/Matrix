export const defaultKeybindings = {
  'ctrl+p': 'workbench.action.quickOpen',
  'ctrl+shift+p': 'workbench.action.showCommands',
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
