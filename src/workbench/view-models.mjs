export async function explorerView(fileService, relativePath = '.') {
  return {
    kind: 'explorer',
    root: relativePath,
    entries: await fileService.listTree(relativePath)
  };
}

export async function searchView(fileService, query) {
  return {
    kind: 'search',
    query,
    results: await fileService.searchText(query)
  };
}

export function problemsView(diagnostics) {
  return {
    kind: 'problems',
    count: diagnostics.length,
    groups: Object.values(
      diagnostics.reduce((accumulator, diagnostic) => {
        accumulator[diagnostic.relativePath] ??= {
          relativePath: diagnostic.relativePath,
          diagnostics: []
        };
        accumulator[diagnostic.relativePath].diagnostics.push(diagnostic);
        return accumulator;
      }, {})
    )
  };
}

export function outputView({ channel, lines, limit = 1000 }) {
  return {
    kind: 'output',
    channel,
    lines: lines.slice(-limit),
    truncated: lines.length > limit
  };
}
