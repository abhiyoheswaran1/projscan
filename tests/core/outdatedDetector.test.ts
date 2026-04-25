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

  describe('workspace-aware (monorepo)', () => {
    it('attributes deps to each workspace package', async () => {
      // Root manifest declares workspaces; each workspace has its own deps.
      await writeJson(path.join(tmp, 'package.json'), {
        name: 'root',
        workspaces: ['packages/*'],
        dependencies: { 'root-only': '^1.0.0' },
      });
      await writeJson(path.join(tmp, 'packages/a/package.json'), {
        name: 'pkg-a',
        dependencies: { 'a-dep': '^1.0.0' },
      });
      await writeJson(path.join(tmp, 'packages/b/package.json'), {
        name: 'pkg-b',
        dependencies: { 'b-dep': '^2.0.0' },
      });

      const workspaces = {
        kind: 'npm' as const,
        packages: [
          { name: 'root', relativePath: '', isRoot: true },
          { name: 'pkg-a', relativePath: 'packages/a', isRoot: false },
          { name: 'pkg-b', relativePath: 'packages/b', isRoot: false },
        ],
      };

      const report = await detectOutdated(tmp, { workspaces });
      expect(report.available).toBe(true);
      expect(report.totalPackages).toBe(3);

      const rootDep = report.packages.find((p) => p.name === 'root-only');
      const aDep = report.packages.find((p) => p.name === 'a-dep');
      const bDep = report.packages.find((p) => p.name === 'b-dep');

      expect(rootDep?.workspace).toBe('root');
      expect(aDep?.workspace).toBe('pkg-a');
      expect(bDep?.workspace).toBe('pkg-b');

      expect(report.byWorkspace).toBeDefined();
      expect(report.byWorkspace).toHaveLength(3);
    });

    it('workspaceFilter limits results to one package', async () => {
      await writeJson(path.join(tmp, 'package.json'), {
        name: 'root',
        workspaces: ['packages/*'],
      });
      await writeJson(path.join(tmp, 'packages/a/package.json'), {
        name: 'pkg-a',
        dependencies: { 'a-dep': '^1.0.0' },
      });
      await writeJson(path.join(tmp, 'packages/b/package.json'), {
        name: 'pkg-b',
        dependencies: { 'b-dep': '^2.0.0' },
      });

      const workspaces = {
        kind: 'npm' as const,
        packages: [
          { name: 'root', relativePath: '', isRoot: true },
          { name: 'pkg-a', relativePath: 'packages/a', isRoot: false },
          { name: 'pkg-b', relativePath: 'packages/b', isRoot: false },
        ],
      };

      const report = await detectOutdated(tmp, { workspaces, workspaceFilter: 'pkg-a' });
      expect(report.totalPackages).toBe(1);
      expect(report.packages[0].workspace).toBe('pkg-a');
      expect(report.packages[0].name).toBe('a-dep');
    });

    it('falls back to single-package mode when workspaces.kind is none', async () => {
      await writeJson(path.join(tmp, 'package.json'), {
        dependencies: { foo: '^1.0.0' },
      });

      const workspaces = { kind: 'none' as const, packages: [] };
      const report = await detectOutdated(tmp, { workspaces });
      expect(report.totalPackages).toBe(1);
      expect(report.byWorkspace).toBeUndefined();
      expect(report.packages[0].workspace).toBeUndefined();
    });
  });
});
