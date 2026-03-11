import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const ESLINT_CONFIG_FILES = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  'eslint.config.mts',
];

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const rootFiles = new Set(
    files.filter((f) => !f.directory || f.directory === '.').map((f) => path.basename(f.relativePath)),
  );

  // Check for config files
  for (const configFile of ESLINT_CONFIG_FILES) {
    if (rootFiles.has(configFile)) return [];
  }

  // Check for eslintConfig in package.json
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    if (pkg.eslintConfig) return [];
  } catch {
    // No package.json or invalid JSON
  }

  // Check if this is a JS/TS project (ESLint only relevant for these)
  const hasJsTs = files.some((f) =>
    ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(f.extension),
  );

  if (!hasJsTs) return [];

  return [
    {
      id: 'missing-eslint',
      title: 'No ESLint configuration',
      description:
        'No ESLint configuration file detected. ESLint helps catch bugs and enforce code style.',
      severity: 'warning',
      category: 'linting',
      fixAvailable: true,
      fixId: 'add-eslint',
    },
  ];
}
