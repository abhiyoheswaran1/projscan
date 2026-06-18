import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computePreflight } from '../../src/core/preflight.js';

const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('before_commit treats scale-only review blocks as manual sign-off caution', async () => {
  const root = await makeCommittedProject();

  await writeComplexChange(root);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'large commit candidate']);

  const report = await computePreflight(root, {
    mode: 'before_commit',
    baseRef: 'HEAD~1',
    headRef: 'HEAD',
    maxChangedFiles: 50,
  });

  expect(report.verdict).toBe('caution');
  expect(report.evidence.releaseScale).toEqual(
    expect.objectContaining({
      detected: true,
      changedFiles: expect.any(Number),
      threshold: 50,
      concreteBlockers: [],
    }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'release',
        severity: 'warning',
        message: expect.stringContaining('Large handoff review risk'),
      }),
    ]),
  );
  expect(report.reasons.map((reason) => reason.message).join('\n')).not.toContain(
    'manual release sign-off',
  );
  expect(report.summary).toContain('manual review sign-off');
  expect(report.summary).not.toContain('manual release sign-off');
  expect(report.reasons.some((reason) => reason.source === 'review')).toBe(false);
  expect(report.evidence.review?.verdict).toBe('block');
  expect(report.requiredChecks.find((check) => check.name === 'review')?.status).toBe('warn');
}, 120_000);

test('before_merge treats scale-only review blocks as manual sign-off caution', async () => {
  const root = await makeCommittedProject();

  await writeComplexChange(root);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'large platform change']);

  const report = await computePreflight(root, {
    mode: 'before_merge',
    baseRef: 'HEAD~1',
    headRef: 'HEAD',
    maxChangedFiles: 1,
  });

  expect(report.verdict).toBe('caution');
  expect(report.evidence.releaseScale).toEqual(
    expect.objectContaining({
      detected: true,
      changedFiles: expect.any(Number),
      threshold: 1,
      concreteBlockers: [],
    }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'release',
        severity: 'warning',
        message: expect.stringContaining('Large platform release risk'),
      }),
    ]),
  );
  expect(report.reasons.some((reason) => reason.source === 'review')).toBe(false);
  expect(report.evidence.review?.verdict).toBe('block');
  expect(report.evidence.releaseScale?.changedFiles).toBeGreaterThan(1);
  expect(report.summary).toContain('manual release sign-off');
  expect(report.summary).not.toContain('block:');
  expect(report.requiredChecks.find((check) => check.name === 'review')?.status).toBe('warn');
  expect(report.requiredChecks.find((check) => check.name === 'review')?.reason).toContain(
    'scale/complexity',
  );
}, 120_000);

async function makeCommittedProject(): Promise<string> {
  const root = await makeTempProject();
  await git(root, ['init']);
  await git(root, ['config', 'user.email', 'agent@example.com']);
  await git(root, ['config', 'user.name', 'Agent']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);
  return root;
}

async function writeComplexChange(root: string): Promise<void> {
  await fs.writeFile(
    path.join(root, 'src', 'index.ts'),
    [
      'export function complex(value: number) {',
      '  if (value > 1) return 1;',
      '  if (value > 2) return 2;',
      '  if (value > 3) return 3;',
      '  if (value > 4) return 4;',
      '  if (value > 5) return 5;',
      '  if (value > 6) return 6;',
      '  if (value > 7) return 7;',
      '  if (value > 8) return 8;',
      '  if (value > 9) return 9;',
      '  if (value > 10) return 10;',
      '  if (value > 11) return 11;',
      '  if (value > 12) return 12;',
      '  if (value > 13) return 13;',
      '  if (value > 14) return 14;',
      '  if (value > 15) return 15;',
      '  if (value > 16) return 16;',
      '  if (value > 17) return 17;',
      '  if (value > 18) return 18;',
      '  if (value > 19) return 19;',
      '  if (value > 20) return 20;',
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# changed\n');
}

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: root });
}

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
