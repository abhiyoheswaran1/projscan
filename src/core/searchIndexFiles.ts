import path from 'node:path';

const SEARCH_INDEXABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
  '.go',
  '.rb',
  '.java',
  '.rs',
  '.php',
  '.cs',
  '.swift',
  '.kt',
  '.md',
  '.mdx',
]);

export function isSearchIndexableFile(relativePath: string): boolean {
  return SEARCH_INDEXABLE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}
