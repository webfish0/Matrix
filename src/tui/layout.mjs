export function computeLayout({ width, height }) {
  if (width < 60 || height < 14) {
    return {
      mode: 'minimum',
      width,
      height,
      regions: {
        message: rect(0, 0, width, height)
      },
      collapse: ['workbench']
    };
  }

  const mode = width >= 120 && height >= 32
    ? 'wide'
    : width >= 80 && height >= 24
      ? 'medium'
      : height < 18
        ? 'short'
        : 'narrow';

  const statusHeight = 1;
  const titleHeight = mode === 'short' ? 1 : 2;
  const panelHeight = mode === 'wide' ? Math.max(6, Math.floor(height * 0.22)) : mode === 'medium' ? 5 : 0;
  const activityWidth = mode === 'narrow' || mode === 'short' ? 0 : 3;
  const primaryWidth = mode === 'wide' ? 32 : mode === 'medium' ? 24 : 0;
  const secondaryWidth = mode === 'wide' ? 18 : 0;
  const bodyY = titleHeight;
  const bodyHeight = height - titleHeight - statusHeight - panelHeight;
  const editorX = activityWidth + primaryWidth;
  const editorWidth = width - editorX - secondaryWidth;

  return {
    mode,
    width,
    height,
    regions: {
      title: rect(0, 0, width, titleHeight),
      activity: rect(0, bodyY, activityWidth, bodyHeight),
      primarySideBar: rect(activityWidth, bodyY, primaryWidth, bodyHeight),
      editor: rect(editorX, bodyY, editorWidth, bodyHeight),
      secondarySideBar: rect(width - secondaryWidth, bodyY, secondaryWidth, bodyHeight),
      panel: rect(0, bodyY + bodyHeight, width, panelHeight),
      status: rect(0, height - statusHeight, width, statusHeight)
    },
    collapse: collapseFor(mode)
  };
}

export function rect(x, y, width, height) {
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
}

function collapseFor(mode) {
  if (mode === 'wide') return [];
  if (mode === 'medium') return ['secondarySideBar'];
  if (mode === 'narrow') return ['secondarySideBar', 'panel', 'primarySideBar', 'activity'];
  if (mode === 'short') return ['secondarySideBar', 'breadcrumbs', 'panel', 'primarySideBar', 'activity'];
  return ['workbench'];
}
