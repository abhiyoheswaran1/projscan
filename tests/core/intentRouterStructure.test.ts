import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

it('keeps intent router focused on scoring orchestration', async () => {
  const source = await readFile(path.join(repoRoot, 'src', 'core', 'intentRouter.ts'), 'utf8');

  expect(source).toContain('intentRouterResult.js');
  expect(source).not.toContain('function routeMatch');
  expect(source).not.toContain('function routeConfidence');
});
