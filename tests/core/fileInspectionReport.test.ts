import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { HotspotReport, Issue } from '../../src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('file inspection includes suggested next actions from file evidence', async () => {
  const root = await makeTempProject();
  const issues: Issue[] = [
    {
      id: 'large-file',
      title: 'Large file',
      description: 'Split this file.',
      severity: 'warning',
      category: 'maintainability',
      fixAvailable: false,
      locations: [{ file: 'src/app route/$(touch pwn).ts', line: 1 }],
    },
  ];
  const hotspots: HotspotReport = {
    available: true,
    window: { since: null, commitsScanned: 0 },
    totalFilesRanked: 1,
    hotspots: [
      {
        relativePath: 'src/app route/$(touch pwn).ts',
        churn: 4,
        distinctAuthors: 1,
        daysSinceLastChange: null,
        lineCount: 2,
        cyclomaticComplexity: 1,
        sizeBytes: 30,
        issueCount: 1,
        issueIds: ['large-file'],
        riskScore: 75,
        reasons: ['large file'],
        primaryAuthor: 'dev@example.com',
        primaryAuthorShare: 1,
        busFactorOne: true,
        topAuthors: [{ author: 'dev@example.com', commits: 4, share: 1 }],
        coverage: null,
      },
    ],
  };

  const inspection = await inspectFile(root, 'src/app route/$(touch pwn).ts', {
    issues,
    hotspots,
  });

  expect(inspection.suggestedNextActions?.map((action) => action.command)).toEqual([
    'projscan impact "src/app route/\\$(touch pwn).ts" --format json',
    'projscan explain-issue large-file --format json',
    'projscan hotspots --format json',
    'projscan search "tests for src/app route/\\$(touch pwn).ts" --format json',
  ]);
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-file-report-'));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, 'src', 'app route'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(root, 'src', 'app route', '$(touch pwn).ts'),
    'export const value = 1;\n',
  );
  return root;
}
