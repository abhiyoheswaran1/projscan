import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface GoProjectInfo {
  /**
   * Module path declared in go.mod (e.g. "github.com/acme/widget"). Local
   * imports starting with this prefix resolve into the repo.
   */
  modulePath: string;
  /** Absolute directory containing go.mod. Imports resolve relative to this. */
  moduleRoot: string;
}

/**
 * Find the closest go.mod and read its module declaration. Searches the
 * repository root first, then any directory that contains at least one .go
 * file (handles nested modules / examples directories).
 *
 * Returns null if no go.mod exists — Go files outside any module are valid
 * (e.g. snippets) but their imports can't be resolved to local files.
 */
export async function detectGoProject(
  rootPath: string,
  files: FileEntry[],
): Promise<GoProjectInfo | null> {
  // 1) Try repo root first — by far the most common case.
  const rootGoMod = await readGoMod(path.join(rootPath, 'go.mod'));
  if (rootGoMod) return { modulePath: rootGoMod, moduleRoot: rootPath };

  // 2) Look for go.mod in any directory containing a .go file. Take the
  // shortest path (closest-to-root) when multiple match.
  const candidates = new Set<string>();
  for (const f of files) {
    if (!f.relativePath.endsWith('.go')) continue;
    let dir = path.posix.dirname(f.relativePath);
    while (dir && dir !== '.' && dir !== '/') {
      candidates.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const sorted = [...candidates].sort((a, b) => a.length - b.length);
  for (const dir of sorted) {
    const p = path.join(rootPath, dir, 'go.mod');
    const mod = await readGoMod(p);
    if (mod) return { modulePath: mod, moduleRoot: path.join(rootPath, dir) };
  }

  return null;
}

async function readGoMod(absPath: string): Promise<string | null> {
  let content: string;
  try {
    content = await fs.readFile(absPath, 'utf-8');
  } catch {
    return null;
  }
  // First non-comment `module <path>` line wins.
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const m = /^module\s+(\S+)/.exec(line);
    if (m) return m[1];
  }
  return null;
}
