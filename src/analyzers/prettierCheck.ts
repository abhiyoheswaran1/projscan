import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const PRETTIER_CONFIG_FILES = [
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.toml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
];

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const rootFiles = new Set(
    files.filter((f) => !f.directory || f.directory === '.').map((f) => path.basename(f.relativePath)),
  );

  for (const configFile of PRETTIER_CONFIG_FILES) {
    if (rootFiles.has(configFile)) return [];
  }

  // Check for prettier key in package.json
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    if (pkg.prettier) return [];
  } catch {
    // No package.json
  }

  // Only relevant for JS/TS/CSS/HTML projects
  const relevantExtensions = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.css', '.scss', '.less', '.html', '.vue', '.svelte', '.json',
  ]);
  const hasRelevantFiles = files.some((f) => relevantExtensions.has(f.extension));
  if (!hasRelevantFiles) return [];

  return [
    {
      id: 'missing-prettier',
      title: 'No Prettier configuration',
      description:
        'No Prettier configuration file detected. Prettier ensures consistent code formatting across your project.',
      severity: 'warning',
      category: 'formatting',
      fixAvailable: true,
      fixId: 'add-prettier',
    },
  ];
}
