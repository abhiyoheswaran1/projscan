import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeRegressionPlan } from '../../src/core/regressionPlan.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('regression plan builds a full verification matrix for the product plan', async () => {
  const root = await makeTempProject();
  await fs.writeFile(path.join(root, 'src', 'danger.ts'), 'eval("console.log(1)");\n');

  const report = await computeRegressionPlan(root, {
    level: 'full',
    lines: ['2.3.x', '2.4.x', '2.5.x', '2.6.x'],
    maxTargets: 6,
  });

  expect(report.schemaVersion).toBe(1);
  expect(report.level).toBe('full');
  expect(report.releaseLines).toEqual(['2.3.x', '2.4.x', '2.5.x', '2.6.x']);
  expect(report.targets.length).toBeGreaterThan(0);
  expect(report.targets.length).toBeLessThanOrEqual(6);
  expect(report.targets.map((target) => target.id)).toEqual(
    expect.arrayContaining(['rp-bug-hunt-top']),
  );
  expect(report.commands).toEqual(
    expect.arrayContaining(['projscan bug-hunt --format json', 'npm test', 'npm run build']),
  );
  expect(report.commands.every((command) => !command.startsWith('projscan_'))).toBe(true);
  expect(
    report.targets
      .flatMap((target) => target.verification.commands)
      .every((command) => !command.startsWith('projscan_')),
  ).toBe(true);
  expect(new Set(report.commands).size).toBe(report.commands.length);
  expect(report.evidence.bugHuntVerdict).toMatch(/^(clean|fix|block)$/);
});

test('regression plan keeps smoke mode small and reproducible', async () => {
  const root = await makeTempProject();

  const report = await computeRegressionPlan(root, { level: 'smoke', maxTargets: 4 });

  expect(report.level).toBe('smoke');
  expect(report.commands).toEqual(
    expect.arrayContaining([
      'projscan doctor --format json',
      'projscan preflight --mode before_commit --format json',
    ]),
  );
  expect(report.commands).not.toContain('npm run release:check');
  expect(report.targets.map((target) => target.source)).toContain('baseline');
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-regression-plan-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '2.2.0', type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
