import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Fix } from '../types.js';

export const prettierFix: Fix = {
  id: 'add-prettier',
  title: 'Install and configure Prettier',
  description: 'Installs Prettier and creates a configuration file',
  issueId: 'missing-prettier',

  async apply(rootPath: string): Promise<void> {
    execSync('npm install --save-dev prettier', {
      cwd: rootPath,
      stdio: 'pipe',
      timeout: 60_000,
    });

    const config = {
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 100,
      tabWidth: 2,
    };

    await fs.writeFile(
      path.join(rootPath, '.prettierrc'),
      JSON.stringify(config, null, 2) + '\n',
      'utf-8',
    );

    // Add format script to package.json if not present
    const pkgPath = path.join(rootPath, 'package.json');
    try {
      const raw = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);

      if (!pkg.scripts) pkg.scripts = {};
      if (!pkg.scripts.format) {
        pkg.scripts.format = 'prettier --write .';
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return; // No package.json - nothing to update
      }
      throw err; // Re-throw JSON parse errors or unexpected failures
    }
  },
};
