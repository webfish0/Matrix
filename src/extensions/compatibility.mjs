const nativeContributionKeys = new Set([
  'commands',
  'keybindings',
  'menus',
  'configuration',
  'views',
  'viewsContainers',
  'languages',
  'grammars',
  'semanticTokenTypes',
  'semanticTokenModifiers',
  'snippets',
  'debuggers',
  'breakpoints',
  'taskDefinitions',
  'problemMatchers',
  'authentication'
]);

const unsupportedContributionKeys = new Set([
  'webviews',
  'customEditors',
  'notebookRenderer',
  'notebookPreload',
  'notebooks'
]);

const partialContributionKeys = new Set([
  'colors',
  'iconThemes',
  'productIconThemes',
  'walkthroughs'
]);

export function classifyExtensionManifest(manifest) {
  const contributions = manifest.contributes ?? {};
  const entries = Object.keys(contributions).map((key) => classifyContribution(key));
  const unsupported = entries.filter((entry) => entry.level === 'unsupported');
  const partial = entries.filter((entry) => entry.level === 'partial' || entry.level === 'textual-fallback');
  const level = unsupported.length > 0
    ? 'unsupported-surfaces'
    : partial.length > 0
      ? 'partial'
      : 'native';
  return {
    schema: 'smith.extension-compatibility.v1',
    extensionId: manifest.publisher && manifest.name ? `${manifest.publisher}.${manifest.name}` : manifest.name,
    extensionKind: manifest.extensionKind ?? ['workspace'],
    level,
    contributions: entries,
    activationEvents: manifest.activationEvents ?? [],
    notes: compatibilityNotes(entries)
  };
}

export function classifyContribution(key) {
  if (nativeContributionKeys.has(key)) {
    return { key, level: 'native', reason: 'mapped to terminal command/view/configuration surfaces' };
  }
  if (unsupportedContributionKeys.has(key)) {
    return { key, level: 'unsupported', reason: 'requires HTML/browser or graphical rendering not available in terminal MVP' };
  }
  if (partialContributionKeys.has(key)) {
    return { key, level: key === 'walkthroughs' ? 'textual-fallback' : 'partial', reason: 'rendered through terminal-safe approximation' };
  }
  return { key, level: 'untested', reason: 'contribution point not yet classified by Smith compatibility registry' };
}

function compatibilityNotes(entries) {
  if (entries.length === 0) {
    return ['No declared contribution points. Runtime API use still requires activation testing.'];
  }
  return entries.map((entry) => `${entry.key}: ${entry.level} (${entry.reason})`);
}
