import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FileEntry } from '../../src/types.js';

export async function makeUpgradePreviewTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-upgrade-'));
}

export async function writeJson(file: string, obj: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj));
}

export async function writeFileEntry(root: string, rel: string, content: string): Promise<FileEntry> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
  const stat = await fs.stat(abs);
  return {
    relativePath: rel.split(path.sep).join('/'),
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.dirname(rel) || '.',
  };
}
