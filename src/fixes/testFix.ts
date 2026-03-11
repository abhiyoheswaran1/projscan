import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Fix } from '../types.js';

export const testFix: Fix = {
  id: 'add-tests',
  title: 'Install and configure Vitest',
  description: 'Installs Vitest and creates a sample test file',
  issueId: 'missing-test-framework',

  async apply(rootPath: string): Promise<void> {
    execSync('npm install --save-dev vitest', {
      cwd: rootPath,
      stdio: 'pipe',
    });

    // Add test script to package.json
    try {
      const pkgPath = path.join(rootPath, 'package.json');
      const raw = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);

      if (!pkg.scripts) pkg.scripts = {};
      if (!pkg.scripts.test) {
        pkg.scripts.test = 'vitest run';
      }
      if (!pkg.scripts['test:watch']) {
        pkg.scripts['test:watch'] = 'vitest';
      }

      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    } catch {
      // No package.json to update
    }

    // Create tests directory and sample test
    const testsDir = path.join(rootPath, 'tests');
    await fs.mkdir(testsDir, { recursive: true });

    const hasTypeScript = await fileExists(path.join(rootPath, 'tsconfig.json'));
    const ext = hasTypeScript ? 'ts' : 'js';

    const sampleTest = `import { describe, it, expect } from 'vitest';

describe('example', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
`;

    const testFilePath = path.join(testsDir, `example.test.${ext}`);
    const exists = await fileExists(testFilePath);
    if (!exists) {
      await fs.writeFile(testFilePath, sampleTest, 'utf-8');
    }
  },
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
