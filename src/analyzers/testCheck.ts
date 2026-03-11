import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const TEST_FRAMEWORKS = ['vitest', 'jest', 'mocha', 'ava', 'tap', 'jasmine', '@playwright/test', 'cypress'];

const TEST_FILE_PATTERNS = ['.test.', '.spec.', '__tests__'];

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const issues: Issue[] = [];

  // Check if this is a JS/TS project
  const hasJsTs = files.some((f) =>
    ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(f.extension),
  );
  if (!hasJsTs) return [];

  // Check for test framework in dependencies
  let hasTestFramework = false;
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const framework of TEST_FRAMEWORKS) {
      if (allDeps[framework]) {
        hasTestFramework = true;
        break;
      }
    }
  } catch {
    // No package.json
  }

  // Check for test files
  const testFiles = files.filter((f) =>
    TEST_FILE_PATTERNS.some((pattern) => f.relativePath.includes(pattern)),
  );

  if (!hasTestFramework) {
    issues.push({
      id: 'missing-test-framework',
      title: 'No test framework detected',
      description:
        'No testing framework found in dependencies. Testing is essential for code quality and reliability.',
      severity: 'warning',
      category: 'testing',
      fixAvailable: true,
      fixId: 'add-tests',
    });
  } else if (testFiles.length === 0) {
    issues.push({
      id: 'no-test-files',
      title: 'No test files found',
      description:
        'A test framework is configured but no test files were found. Consider adding tests for your code.',
      severity: 'info',
      category: 'testing',
      fixAvailable: false,
    });
  }

  return issues;
}
