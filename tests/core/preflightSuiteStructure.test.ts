import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';

test('release-scale preflight fixtures live in a focused suite', async () => {
  const mainSuite = await fs.readFile(path.join(process.cwd(), 'tests/core/preflight.test.ts'), {
    encoding: 'utf-8',
  });
  const releaseScaleSuite = await fs.readFile(
    path.join(process.cwd(), 'tests/core/preflightReleaseScale.test.ts'),
    { encoding: 'utf-8' },
  );

  expect(mainSuite).not.toContain('scale-only review blocks');
  expect(mainSuite).not.toContain('manual release sign-off caution');
  expect(releaseScaleSuite).toContain('before_commit treats scale-only review blocks');
  expect(releaseScaleSuite).toContain('before_merge treats scale-only review blocks');
});

test('swarm coordination preflight fixture lives in a focused suite', async () => {
  const mainSuite = await fs.readFile(path.join(process.cwd(), 'tests/core/preflight.test.ts'), {
    encoding: 'utf-8',
  });
  const coordinationSuite = await fs.readFile(
    path.join(process.cwd(), 'tests/core/preflightCoordination.test.ts'),
    { encoding: 'utf-8' },
  );

  expect(mainSuite).not.toContain('swarm-coordination evidence');
  expect(mainSuite).not.toContain("['worktree', 'add'");
  expect(coordinationSuite).toContain('preflight surfaces swarm-coordination evidence');
});
