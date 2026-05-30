import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeDogfoodReport } from '../../src/index.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('dogfood report evaluates multiple repos and tells teams what is still missing', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
    await makeRepo('admin'),
    await makeRepo('jobs'),
  ];

  const report = await computeDogfoodReport(process.cwd(), { repos, targetRepoCount: 5 });

  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.summary).toContain('5 repo');
  expect(report.targetRepoCount).toBe(5);
  expect(report.repos).toHaveLength(5);
  expect(report.totals.reposEvaluated).toBe(5);
  expect(report.totals.prCommentReady).toBe(5);
  expect(report.totals.repeatUseReady).toBe(5);
  expect(report.repos[0].feedbackQuestions).toEqual(
    expect.arrayContaining([
      'Did the PR comment save 10-20 minutes?',
      'What was missing or noisy?',
    ]),
  );
  expect(report.suggestedNextActions.map((action) => action.command)).toEqual(
    expect.arrayContaining(['projscan dogfood --repo <path-to-repo> --format json']),
  );
});

async function makeRepo(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dogfood-' + name + '-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name, version: '0.0.0', type: 'module' }, null, 2) + '\n',
  );
  await fs.writeFile(path.join(root, 'README.md'), '# ' + name + '\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
