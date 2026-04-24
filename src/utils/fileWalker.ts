import fg from 'fast-glob';
import path from 'node:path';
import type { FileEntry } from '../types.js';

export interface WalkOptions {
  ignore?: string[];
  extensions?: string[];
}

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.cache/**',
  '**/.turbo/**',
  '**/.output/**',
  // Python noise. Without these, a repo with a committed virtualenv
  // or interpreter bytecode cache would scan thousands of third-party
  // files and tank the health score.
  '**/venv/**',
  '**/.venv/**',
  '**/env/**',
  '**/.env/**',
  '**/__pycache__/**',
  '**/.tox/**',
  '**/.pytest_cache/**',
  '**/.mypy_cache/**',
  '**/.ruff_cache/**',
  '**/.eggs/**',
  '**/*.egg-info/**',
];

export async function walkFiles(rootPath: string, options?: WalkOptions): Promise<FileEntry[]> {
  const ignore = options?.ignore ?? DEFAULT_IGNORE;

  let pattern = '**/*';
  if (options?.extensions?.length) {
    const exts = options.extensions.map((e) => e.replace(/^\./, ''));
    pattern = exts.length === 1 ? `**/*.${exts[0]}` : `**/*.{${exts.join(',')}}`;
  }

  const entries = await fg(pattern, {
    cwd: rootPath,
    absolute: false,
    dot: true,
    ignore,
    stats: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  return entries.map((entry) => {
    const relativePath = typeof entry === 'string' ? entry : entry.path;
    const stats = typeof entry === 'string' ? undefined : entry.stats;

    return {
      relativePath,
      absolutePath: path.resolve(rootPath, relativePath),
      extension: path.extname(relativePath).toLowerCase(),
      sizeBytes: stats?.size ?? 0,
      directory: path.dirname(relativePath),
    };
  });
}

export function getDefaultIgnorePatterns(): string[] {
  return [...DEFAULT_IGNORE];
}
