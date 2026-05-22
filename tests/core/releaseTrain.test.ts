import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeReleaseTrain } from '../../src/core/releaseTrain.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('release train rolls 2.3.x and 2.4.x into one unreleased plan without mutating version', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeReleaseTrain(root, {
    lines: ['2.3.x', '2.4.x'],
    rollup: 'unreleased',
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as { version: string };
  expect(pkg.version).toBe('2.2.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.currentVersion).toBe('2.2.0');
  expect(report.rollup.releaseMutation).toBe(false);
  expect(report.rollup.policy).toBe('single-unreleased-release');
  expect(report.rollup.lines).toEqual(['2.3.x', '2.4.x']);
  expect(report.tracks.map((track) => track.line)).toEqual(['2.3.x', '2.4.x']);
  expect(report.tracks[0]?.theme).toContain('Mission Control');
  expect(report.tracks[1]?.theme).toContain('Bug Hunt');
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining(['rt-2-3-agent-readiness', 'rt-2-4-bug-hunt-gate', 'rt-rollup-readiness']),
  );
});

test('release train marks blockers when preflight blocks', async () => {
  const root = await makeTempProject('2.2.0');
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '2.2.0',
    type: 'module',
    dependencies: {
      '@tanstack/react-router': '1.169.5',
    },
  });

  const report = await computeReleaseTrain(root);

  expect(report.readiness.verdict).toBe('block');
  expect(report.readiness.blockers).toBeGreaterThan(0);
  expect(report.tasks[0]).toEqual(
    expect.objectContaining({
      priority: 'p0',
      id: 'rt-blockers-first',
    }),
  );
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-release-train-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), { name: 'fixture', version, type: 'module' });
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
