import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeEvidencePack } from '../../src/core/releaseEvidence.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('evidence pack composes the four-line unreleased train without mutating version', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeEvidencePack(root, {
    lines: ['2.3.x', '2.4.x', '2.5.x', '2.6.x'],
    includeWebsitePrompt: true,
    maxFindings: 4,
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as { version: string };
  expect(pkg.version).toBe('2.2.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.currentVersion).toBe('2.2.0');
  expect(report.releaseMutation).toBe(false);
  expect(report.train.lines).toEqual(['2.3.x', '2.4.x', '2.5.x', '2.6.x']);
  expect(report.artifacts.map((artifact) => artifact.id)).toEqual(
    expect.arrayContaining(['ep-release-train', 'ep-bug-hunt', 'ep-workplan', 'ep-preflight']),
  );
  expect(report.changelogEntries).toEqual(
    expect.arrayContaining([
      expect.stringContaining('projscan_evidence_pack'),
      expect.stringContaining('projscan_regression_plan'),
    ]),
  );
  expect(report.websitePrompt).toContain('projscan_evidence_pack');
  expect(report.approval.required).toBe(true);
  expect(report.approval.recommendation.length).toBeGreaterThan(0);
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-evidence-pack-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', version, type: 'module' }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
