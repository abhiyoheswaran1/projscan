import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

it('keeps the core intent router smoke suite focused on issue and search routing', async () => {
  const source = await readFile(path.join(repoRoot, 'tests', 'core', 'intentRouter.test.ts'), 'utf8');
  const lines = source.trimEnd().split('\n');

  expect(lines.length).toBeLessThanOrEqual(90);
  expect(source).not.toContain('what are the scariest untested files');
  expect(source).not.toContain('where is PII handled');
  expect(source).not.toContain('what can I do in five minutes');
  expect(source).not.toContain('what tech debt should I pay down');
});
