import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

test('CLI start smoke suite stays compact and leaves routing cases to focused files', async () => {
  const source = await readFile(path.join(repoRoot, 'tests', 'cli', 'start.test.ts'), 'utf8');
  const lines = source.trimEnd().split('\n');

  expect(lines.length).toBeLessThanOrEqual(100);
  expect(source).not.toContain('prepare this branch for release');
  expect(source).not.toContain('is it safe to commit this change');
});
