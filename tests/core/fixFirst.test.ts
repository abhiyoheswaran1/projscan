import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeBugHunt } from '../../src/core/bugHunt.js';
import { computeQualityScorecard } from '../../src/core/qualityScorecard.js';
import { computeStartReport } from '../../src/core/start.js';
import { computeWorkplan } from '../../src/core/workplan.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('agent surfaces expose the same explicit fix-first recommendation', async () => {
  const root = await makeProjectWithMissingTestScript();

  const [bugHunt, quality, workplan, start] = await Promise.all([
    computeBugHunt(root),
    computeQualityScorecard(root),
    computeWorkplan(root, { mode: 'bug_hunt' }),
    computeStartReport(root, { mode: 'bug_hunt' }),
  ]);

  expect(bugHunt.fixFirst).toMatchObject({
    id: expect.any(String),
    title: expect.any(String),
    priority: expect.stringMatching(/^p[0-2]$/),
    whyFirst: expect.stringMatching(/first|highest|blocking|verification/i),
    commands: expect.arrayContaining(['projscan doctor --format json']),
  });
  expect(quality.fixFirst?.id).toBeTruthy();
  expect(workplan.fixFirst?.id).toBeTruthy();
  expect(start.fixFirst?.id).toBeTruthy();
  expect(start.summary).toContain(start.fixFirst!.title);
});

async function makeProjectWithMissingTestScript(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fix-first-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module', scripts: { build: 'tsc' } }, null, 2));
  await fs.writeFile(path.join(root, '.gitignore'), 'node_modules/\ndist/\n.env\n.env.*\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
