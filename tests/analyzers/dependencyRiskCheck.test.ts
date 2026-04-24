import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/dependencyRiskCheck.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-deprisk-'));
}

async function writePackageJson(root: string, pkg: Record<string, unknown>): Promise<void> {
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2));
}

describe('dependencyRiskCheck', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns no issues when package.json is missing', async () => {
    const issues = await check(tmp, []);
    expect(issues).toHaveLength(0);
  });

  it('returns no issues for a clean package.json', async () => {
    await writePackageJson(tmp, { dependencies: { react: '^18.0.0' } });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');
    const issues = await check(tmp, []);
    expect(issues).toHaveLength(0);
  });

  it('flags deprecated packages as errors', async () => {
    await writePackageJson(tmp, { dependencies: { moment: '^2.0.0', request: '^2.0.0' } });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');

    const issues = await check(tmp, []);
    const moment = issues.find((i) => i.id === 'dep-risk-moment');
    const request = issues.find((i) => i.id === 'dep-risk-request');

    expect(moment).toBeDefined();
    expect(moment!.severity).toBe('error');
    expect(moment!.category).toBe('dependencies');
    expect(moment!.title).toContain('moment');
    expect(request).toBeDefined();
    expect(request!.severity).toBe('error');
  });

  it('flags heavy packages as warnings', async () => {
    await writePackageJson(tmp, { dependencies: { lodash: '^4.0.0' } });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');
    const issues = await check(tmp, []);
    const lodash = issues.find((i) => i.id === 'dep-risk-lodash');
    expect(lodash).toBeDefined();
    expect(lodash!.severity).toBe('warning');
  });

  it('does not flag heavy packages when only in devDependencies', async () => {
    await writePackageJson(tmp, { devDependencies: { lodash: '^4.0.0' } });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');
    const issues = await check(tmp, []);
    expect(issues.find((i) => i.id === 'dep-risk-lodash')).toBeUndefined();
  });

  it('flags excessive-dependencies (>100) as project-level error', async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 101; i++) deps[`pkg-${i}`] = '1.0.0';
    await writePackageJson(tmp, { dependencies: deps });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');

    const issues = await check(tmp, []);
    const issue = issues.find((i) => i.id === 'dep-risk-excessive-dependencies');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    expect(issue!.title).toContain('101');
    expect(issue!.locations).toEqual([{ file: 'package.json' }]);
  });

  it('flags many-dependencies (>50) as project-level warning', async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 51; i++) deps[`pkg-${i}`] = '1.0.0';
    await writePackageJson(tmp, { dependencies: deps });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');

    const issues = await check(tmp, []);
    const issue = issues.find((i) => i.id === 'dep-risk-many-dependencies');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.locations).toEqual([{ file: 'package.json' }]);
  });

  it('flags wildcard version ranges', async () => {
    await writePackageJson(tmp, { dependencies: { 'some-pkg': '*', 'open-range': '>=1.0.0' } });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');

    const issues = await check(tmp, []);
    const star = issues.find((i) => i.id === 'dep-risk-some-pkg');
    const open = issues.find((i) => i.id === 'dep-risk-open-range');
    expect(star).toBeDefined();
    expect(star!.severity).toBe('error');
    expect(open).toBeDefined();
  });

  it('flags missing lockfile when dependencies exist', async () => {
    await writePackageJson(tmp, { dependencies: { react: '^18.0.0' } });
    const issues = await check(tmp, []);
    const issue = issues.find((i) => i.id === 'dep-risk-no-lockfile');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('does not flag missing lockfile when there are no dependencies', async () => {
    await writePackageJson(tmp, {});
    const issues = await check(tmp, []);
    expect(issues.find((i) => i.id === 'dep-risk-no-lockfile')).toBeUndefined();
  });

  it.each(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])(
    'accepts %s as a valid lockfile',
    async (lockfile) => {
      await writePackageJson(tmp, { dependencies: { react: '^18.0.0' } });
      await fs.writeFile(path.join(tmp, lockfile), '');
      const issues = await check(tmp, []);
      expect(issues.find((i) => i.id === 'dep-risk-no-lockfile')).toBeUndefined();
    },
  );

  it('attaches a package.json line number to per-dependency risks', async () => {
    await writePackageJson(tmp, { dependencies: { moment: '^2.0.0', lodash: '^4.0.0' } });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');

    const issues = await check(tmp, []);
    const moment = issues.find((i) => i.id === 'dep-risk-moment');
    expect(moment?.locations?.[0]?.file).toBe('package.json');
    expect(typeof moment?.locations?.[0]?.line).toBe('number');
    expect(moment!.locations![0].line).toBeGreaterThan(0);
  });

  it('does not attach a line number to project-level risks', async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 101; i++) deps[`pkg-${i}`] = '1.0.0';
    await writePackageJson(tmp, { dependencies: deps });
    await fs.writeFile(path.join(tmp, 'package-lock.json'), '{}');

    const issues = await check(tmp, []);
    const issue = issues.find((i) => i.id === 'dep-risk-excessive-dependencies');
    expect(issue!.locations).toEqual([{ file: 'package.json' }]);
    expect(issue!.locations![0].line).toBeUndefined();
  });
});
