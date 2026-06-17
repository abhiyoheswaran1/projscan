import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

test('start smoke suite stays compact and leaves routing coverage in named suites', () => {
  const startSource = readFileSync(path.join(process.cwd(), 'tests/core/start.test.ts'), 'utf8');

  expect(startSource.split('\n').length).toBeLessThanOrEqual(80);
  expect(startSource).not.toContain('what workspaces are in this repo');
  expect(startSource).not.toContain('which workspace owns auth');
  expect(startSource).not.toContain('who owns auth');
  expect(startSource).not.toContain('show circular dependencies');
  expect(startSource).not.toContain('what modules are tightly coupled');
});
