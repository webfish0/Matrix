export function completionView({ items, prefix }) {
  return {
    kind: 'completion',
    prefix,
    items: items
      .filter((item) => item.label.startsWith(prefix))
      .map((item) => ({
        label: item.label,
        detail: item.detail ?? '',
        documentation: item.documentation ?? '',
        insertText: item.insertText ?? item.label
      }))
  };
}

export function diagnosticsView(diagnostics) {
  return diagnostics.map((diagnostic) => ({
    relativePath: diagnostic.relativePath,
    range: diagnostic.range,
    severity: diagnostic.severity,
    source: diagnostic.source ?? 'unknown',
    message: diagnostic.message,
    terminalMarker: markerForSeverity(diagnostic.severity)
  }));
}

export function hoverView({ contents, range }) {
  return {
    kind: 'hover',
    range,
    lines: Array.isArray(contents) ? contents : String(contents).split(/\r?\n/u)
  };
}

export function codeActionView(actions) {
  return {
    kind: 'code-actions',
    actions: actions.map((action) => ({
      title: action.title,
      kind: action.kind ?? 'quickfix',
      isPreferred: Boolean(action.isPreferred),
      command: action.command ?? null
    }))
  };
}

function markerForSeverity(severity) {
  if (severity === 'error') return 'E';
  if (severity === 'warning') return 'W';
  if (severity === 'information') return 'I';
  return 'H';
}
