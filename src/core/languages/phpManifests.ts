import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';

export interface PhpProjectInfo {
  /** Absolute directory containing composer.json. Imports resolve relative to its autoload roots. */
  projectRoot: string;
  /**
   * PSR-4 namespace prefixes mapped to a relative source root. Example:
   * `[{ prefix: 'App\\', root: 'src' }, { prefix: 'App\\Tests\\', root: 'tests' }]`.
   * Resolution strategy: longest prefix match wins.
   */
  psr4: Array<{ prefix: string; root: string }>;
  /**
   * `autoload.classmap` entries (relative dirs / files). PSR-4 covers most
   * modern PHP; classmap is older but still common in legacy code.
   */
  classmap: string[];
}

/**
 * Find the closest composer.json and read its autoload section. Tries the
 * repo root first, then walks up from any directory containing a `.php`
 * file. Returns null when no composer.json exists; .php files outside any
 * Composer project are valid (snippets, scratch files) but their `use`
 * clauses can't be resolved to local files.
 *
 * Both `autoload` and `autoload-dev` are read so that test files importing
 * from `App\Tests\` resolve. PSR-4 always wins over classmap when both
 * could resolve a path.
 */
export async function detectPhpProject(
  rootPath: string,
  files: FileEntry[],
): Promise<PhpProjectInfo | null> {
  // 1) Try repo root.
  const fromRoot = await readComposer(rootPath);
  if (fromRoot) return fromRoot;

  // 2) Walk up from .php file directories.
  const candidates = new Set<string>();
  for (const f of files) {
    if (!f.relativePath.endsWith('.php')) continue;
    let dir = path.posix.dirname(f.relativePath);
    while (dir && dir !== '.' && dir !== '/') {
      candidates.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const sorted = [...candidates].sort((a, b) => a.length - b.length);
  for (const dir of sorted) {
    const project = await readComposer(path.join(rootPath, dir));
    if (project) return project;
  }
  return null;
}

async function readComposer(dir: string): Promise<PhpProjectInfo | null> {
  const p = path.join(dir, 'composer.json');
  let raw: string;
  try {
    raw = await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const psr4: Array<{ prefix: string; root: string }> = [];
  const classmap: string[] = [];

  for (const key of ['autoload', 'autoload-dev'] as const) {
    const block = parsed[key];
    if (!block || typeof block !== 'object') continue;
    const psr4Block = (block as Record<string, unknown>)['psr-4'];
    if (psr4Block && typeof psr4Block === 'object') {
      for (const [prefix, target] of Object.entries(psr4Block as Record<string, unknown>)) {
        if (typeof target === 'string') {
          psr4.push({ prefix, root: stripTrailingSlash(target) });
        } else if (Array.isArray(target)) {
          for (const t of target) {
            if (typeof t === 'string') psr4.push({ prefix, root: stripTrailingSlash(t) });
          }
        }
      }
    }
    const cm = (block as Record<string, unknown>).classmap;
    if (Array.isArray(cm)) {
      for (const entry of cm)
        if (typeof entry === 'string') classmap.push(stripTrailingSlash(entry));
    }
  }

  // Sort PSR-4 entries by prefix length descending so longest-match resolution
  // is a single pass.
  psr4.sort((a, b) => b.prefix.length - a.prefix.length);

  return { projectRoot: dir, psr4, classmap };
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}
