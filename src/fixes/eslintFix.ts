import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Fix } from '../types.js';
import { fileExists } from '../utils/fileHelpers.js';

export const eslintFix: Fix = {
  id: 'add-eslint',
  title: 'Install and configure ESLint',
  description: 'Installs ESLint and creates a configuration file',
  issueId: 'missing-eslint',

  async apply(rootPath: string): Promise<void> {
    const hasTypeScript = await fileExists(path.join(rootPath, 'tsconfig.json'));

    const packages = ['eslint'];
    if (hasTypeScript) {
      packages.push('@typescript-eslint/parser', '@typescript-eslint/eslint-plugin');
    }

    execSync(`npm install --save-dev ${packages.join(' ')}`, {
      cwd: rootPath,
      stdio: 'pipe',
      timeout: 60_000,
    });

    const config = hasTypeScript
      ? {
          env: { node: true, es2022: true },
          parser: '@typescript-eslint/parser',
          plugins: ['@typescript-eslint'],
          extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
          rules: {},
        }
      : {
          env: { node: true, es2022: true },
          extends: ['eslint:recommended'],
          parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
          rules: {},
        };

    await fs.writeFile(
      path.join(rootPath, '.eslintrc.json'),
      JSON.stringify(config, null, 2) + '\n',
      'utf-8',
    );
  },
};
