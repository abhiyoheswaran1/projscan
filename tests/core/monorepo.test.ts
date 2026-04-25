import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  detectWorkspaces,
  filterFilesByPackage,
  findPackageForFile,
} from '../../src/core/monorepo.js';
import type { WorkspaceInfo } from '../../src/types.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-monorepo-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeJson(rel: string, obj: unknown): Promise<void> {
  const abs = path.join(tmp, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(obj));
}

async function writeText(rel: string, body: string): Promise<void> {
  const abs = path.join(tmp, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body);
}

describe('detectWorkspaces', () => {
  it('returns kind=none for a non-monorepo (no package.json)', async () => {
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('none');
    expect(info.packages).toEqual([]);
  });

  it('returns kind=none for a single package.json without workspaces', async () => {
    await writeJson('package.json', { name: 'solo', version: '1.0.0' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('none');
    expect(info.packages).toHaveLength(1);
    expect(info.packages[0].name).toBe('solo');
    expect(info.packages[0].isRoot).toBe(true);
  });

  it('detects npm/yarn workspaces from package.json (array form)', async () => {
    await writeJson('package.json', {
      name: 'root',
      version: '0.0.1',
      workspaces: ['packages/*'],
    });
    await writeJson('packages/a/package.json', { name: '@acme/a', version: '0.1.0' });
    await writeJson('packages/b/package.json', { name: '@acme/b', version: '0.2.0' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('npm'); // no yarn.lock
    expect(info.packages.map((p) => p.name).sort()).toEqual(['@acme/a', '@acme/b', 'root']);
  });

  it('labels yarn when yarn.lock is present', async () => {
    await writeJson('package.json', { name: 'root', workspaces: ['packages/*'] });
    await writeText('yarn.lock', '');
    await writeJson('packages/a/package.json', { name: 'a' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('yarn');
  });

  it('detects pnpm workspaces from pnpm-workspace.yaml', async () => {
    await writeJson('package.json', { name: 'root' });
    await writeText('pnpm-workspace.yaml', `packages:\n  - 'packages/*'\n  - "apps/*"\n`);
    await writeJson('packages/lib/package.json', { name: 'lib' });
    await writeJson('apps/web/package.json', { name: 'web' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('pnpm');
    const names = info.packages.map((p) => p.name).sort();
    expect(names).toEqual(['lib', 'root', 'web']);
  });

  it('falls back to packages/* + apps/* + libs/* when only nx.json is present', async () => {
    await writeText('nx.json', '{}');
    await writeJson('packages/lib/package.json', { name: 'lib' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('nx');
    expect(info.packages.find((p) => p.name === 'lib')).toBeDefined();
  });
});

describe('findPackageForFile / filterFilesByPackage', () => {
  const ws: WorkspaceInfo = {
    kind: 'npm',
    packages: [
      { name: 'root', relativePath: '', isRoot: true },
      { name: '@acme/a', relativePath: 'packages/a', isRoot: false },
      { name: '@acme/ab', relativePath: 'packages/ab', isRoot: false },
    ],
  };

  it('matches the deepest prefix (avoid packages/a swallowing packages/ab)', () => {
    expect(findPackageForFile(ws, 'packages/a/src/x.ts')?.name).toBe('@acme/a');
    expect(findPackageForFile(ws, 'packages/ab/src/x.ts')?.name).toBe('@acme/ab');
  });

  it('falls back to root for files outside any package', () => {
    expect(findPackageForFile(ws, 'scripts/release.ts')?.name).toBe('root');
  });

  it('filterFilesByPackage("@acme/a") keeps only that package\'s files', () => {
    const files = ['packages/a/x.ts', 'packages/a/y.ts', 'packages/ab/z.ts', 'scripts/r.ts'];
    expect(filterFilesByPackage(ws, '@acme/a', files)).toEqual([
      'packages/a/x.ts',
      'packages/a/y.ts',
    ]);
  });

  it('filterFilesByPackage("root") keeps everything (root has no path prefix)', () => {
    const files = ['packages/a/x.ts', 'scripts/r.ts'];
    expect(filterFilesByPackage(ws, 'root', files)).toEqual(files);
  });

  it('returns [] for an unknown package name', () => {
    expect(filterFilesByPackage(ws, 'nope', ['packages/a/x.ts'])).toEqual([]);
  });
});
