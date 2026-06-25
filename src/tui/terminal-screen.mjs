export class TerminalScreen {
  constructor({ width, height, scrollbackLimit = 1000 }) {
    this.width = width;
    this.height = height;
    this.scrollbackLimit = scrollbackLimit;
    this.rows = Array.from({ length: height }, () => '');
    this.scrollback = [];
    this.cursor = { x: 0, y: 0 };
  }

  write(input) {
    const text = stripAnsi(input);
    for (const char of text) {
      if (char === '\r') {
        this.cursor.x = 0;
      } else if (char === '\n') {
        this.newLine();
      } else {
        const row = this.rows[this.cursor.y] ?? '';
        this.rows[this.cursor.y] = replaceAt(row.padEnd(this.width, ' '), this.cursor.x, char).slice(0, this.width);
        this.cursor.x += 1;
        if (this.cursor.x >= this.width) {
          this.newLine();
        }
      }
    }
  }

  resize({ width, height }) {
    this.width = width;
    this.height = height;
    while (this.rows.length > height) {
      this.scrollback.push(this.rows.shift());
    }
    while (this.rows.length < height) {
      this.rows.push('');
    }
    this.scrollback = this.scrollback.slice(-this.scrollbackLimit);
    this.cursor.x = Math.min(this.cursor.x, width - 1);
    this.cursor.y = Math.min(this.cursor.y, height - 1);
  }

  snapshot() {
    return this.rows.map((row) => row.padEnd(this.width, ' ').slice(0, this.width));
  }

  newLine() {
    this.cursor.x = 0;
    this.cursor.y += 1;
    if (this.cursor.y >= this.height) {
      this.scrollback.push(this.rows.shift());
      this.rows.push('');
      this.scrollback = this.scrollback.slice(-this.scrollbackLimit);
      this.cursor.y = this.height - 1;
    }
  }
}

function stripAnsi(input) {
  return String(input).replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
}

function replaceAt(value, index, char) {
  return `${value.slice(0, index)}${char}${value.slice(index + 1)}`;
}
