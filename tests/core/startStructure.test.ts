import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

test('start entrypoint delegates derived report context assembly', async () => {
  const source = await readFile(path.join(repoRoot, 'src', 'core', 'start.ts'), 'utf8');

  expect(source).toContain('startReportContext.js');
  expect(source).not.toContain('buildMissionControl');
  expect(source).not.toContain('buildStartNextActions');
});
