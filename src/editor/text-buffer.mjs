export class TextBuffer {
  constructor({ relativePath, content, version }) {
    this.relativePath = relativePath;
    this.content = content;
    this.savedVersion = version;
    this.undoStack = [];
    this.redoStack = [];
  }

  get dirty() {
    return this.undoStack.length > 0;
  }

  replace(range, text) {
    const before = this.content;
    const start = offsetAt(before, range.start);
    const end = offsetAt(before, range.end);
    this.content = `${before.slice(0, start)}${text}${before.slice(end)}`;
    this.undoStack.push(before);
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.content);
    this.content = this.undoStack.pop();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.content);
    this.content = this.redoStack.pop();
    return true;
  }

  markSaved(version) {
    this.savedVersion = version;
    this.undoStack = [];
    this.redoStack = [];
  }
}

export function offsetAt(content, position) {
  const lines = content.split('\n');
  let offset = 0;
  for (let line = 1; line < position.line; line++) {
    offset += (lines[line - 1] ?? '').length + 1;
  }
  return offset + Math.max(0, position.column - 1);
}

export function utf16PositionAt(content, offset) {
  const prefix = content.slice(0, offset);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines.at(-1).length + 1
  };
}

export function graphemeCount(value) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length;
  }
  return [...value].length;
}

export function displayCellWidth(value) {
  let width = 0;
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code === 0 || code < 32) continue;
    width += isWide(code) ? 2 : 1;
  }
  return width;
}

function isWide(code) {
  return (
    code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6))
  );
}
