import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectOutdated } from '../../src/core/outdatedDetector.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-outdated-'));
}

async function writeJson(file: string, obj: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj));
}

describe('detectOutdated', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns unavailable when no package.json', async () => {
    const report = await detectOutdated(tmp);
    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/No package.json/);
  });

  it('returns unavailable when package.json is malformed', async () => {
    await fs.writeFile(path.join(tmp, 'package.json'), '{ invalid');
    const report = await detectOutdated(tmp);
    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/not valid JSON/);
  });

  it('reports drift when declared and installed differ', async () => {
    await writeJson(path.join(tmp, 'package.json'), {
      dependencies: { foo: '^1.0.0' },
      devDependencies: { bar: '^2.0.0' },
    });
    await writeJson(path.join(tmp, 'node_modules/foo/package.json'), { version: '2.1.5' });
    await writeJson(path.join(tmp, 'node_modules/bar/package.json'), { version: '2.0.1' });

    const report = await detectOutdated(tmp);
    expect(report.available).toBe(true);
    expect(report.totalPackages).toBe(2);

    const foo = report.packages.find((p) => p.name === 'foo');
    const bar = report.packages.find((p) => p.name === 'bar');
    expect(foo?.drift).toBe('major');
    expect(foo?.scope).toBe('dependency');
    expect(bar?.drift).toBe('patch');
    expect(bar?.scope).toBe('devDependency');
  });

  it('flags packages as not installed when node_modules entry missing', async () => {
    await writeJson(path.join(tmp, 'package.json'), {
      dependencies: { missing: '^1.0.0' },
    });
    // no node_modules directory
    const report = await detectOutdated(tmp);
    const missing = report.packages.find((p) => p.name === 'missing');
    expect(missing?.installed).toBeNull();
    expect(missing?.drift).toBe('unknown');
  });
});
