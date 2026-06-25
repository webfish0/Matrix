import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

export class WorkspaceFileService {
  constructor(root) {
    this.root = resolve(root);
  }

  path(relativePath) {
    const fullPath = resolve(this.root, relativePath);
    if (fullPath !== this.root && !fullPath.startsWith(`${this.root}${sep}`)) {
      throw new Error(`Path escapes workspace: ${relativePath}`);
    }
    return fullPath;
  }

  async readText(relativePath) {
    const fullPath = this.path(relativePath);
    const content = await readFile(fullPath, 'utf8');
    const metadata = await stat(fullPath);
    return {
      relativePath,
      content,
      version: versionFromStat(metadata)
    };
  }

  async writeText(relativePath, content, { expectedVersion } = {}) {
    const fullPath = this.path(relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    if (expectedVersion !== undefined) {
      try {
        const current = versionFromStat(await stat(fullPath));
        if (current !== expectedVersion) {
          throw new Error(`Save conflict for ${relativePath}: expected ${expectedVersion}, found ${current}`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
    await writeFile(fullPath, content, 'utf8');
    return versionFromStat(await stat(fullPath));
  }

  async rename(from, to) {
    await mkdir(dirname(this.path(to)), { recursive: true });
    await rename(this.path(from), this.path(to));
  }

  async delete(relativePath) {
    await rm(this.path(relativePath), { recursive: true, force: false });
  }

  async listTree(relativePath = '.') {
    const base = this.path(relativePath);
    const entries = await readdir(base, { withFileTypes: true });
    return entries
      .map((entry) => ({
        name: entry.name,
        relativePath: normalizeRelative(join(relativePath, entry.name)),
        kind: entry.isDirectory() ? 'directory' : 'file'
      }))
      .sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`));
  }

  async searchText(query) {
    const results = [];
    await this.walk('.', async (file) => {
      const content = await readFile(this.path(file), 'utf8');
      const lines = content.split(/\r?\n/u);
      lines.forEach((line, index) => {
        const column = line.indexOf(query);
        if (column !== -1) {
          results.push({ relativePath: file, line: index + 1, column: column + 1, preview: line.trim() });
        }
      });
    });
    return results;
  }

  async walk(relativePath, visitFile) {
    for (const entry of await this.listTree(relativePath)) {
      if (entry.kind === 'directory') {
        await this.walk(entry.relativePath, visitFile);
      } else {
        await visitFile(entry.relativePath);
      }
    }
  }
}

function normalizeRelative(value) {
  const normalized = value.split(sep).join('/');
  return normalized === '.' ? normalized : normalized.replace(/^\.\//u, '');
}

function versionFromStat(metadata) {
  return `${metadata.mtimeMs}:${metadata.size}`;
}
