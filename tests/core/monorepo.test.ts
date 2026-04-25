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

  it('reads lerna.json packages field directly', async () => {
    await writeJson('lerna.json', { packages: ['modules/*', 'tools/*'] });
    await writeJson('modules/api/package.json', { name: 'api' });
    await writeJson('tools/cli/package.json', { name: 'cli' });
    // Decoy in packages/ that lerna.json explicitly does NOT list.
    await writeJson('packages/x/package.json', { name: 'should-not-appear' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('lerna');
    const names = info.packages.map((p) => p.name).sort();
    expect(names).toEqual(['api', 'cli']);
  });

  it('lerna.json without explicit packages field defaults to packages/*', async () => {
    await writeJson('lerna.json', {});
    await writeJson('packages/a/package.json', { name: 'a' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('lerna');
    expect(info.packages.find((p) => p.name === 'a')).toBeDefined();
  });

  it('detects Nx projects via project.json scan (modern Nx)', async () => {
    await writeJson('nx.json', {});
    await writeJson('apps/web/project.json', { name: 'web' });
    await writeJson('libs/shared/project.json', { name: 'shared' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('nx');
    const names = info.packages.map((p) => p.name).sort();
    expect(names).toContain('web');
    expect(names).toContain('shared');
  });

  it('honors nx.json workspaceLayout (custom appsDir / libsDir)', async () => {
    await writeJson('nx.json', { workspaceLayout: { appsDir: 'applications', libsDir: 'libraries' } });
    await writeJson('applications/portal/project.json', { name: 'portal' });
    await writeJson('libraries/utils/project.json', { name: 'utils' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('nx');
    const paths = info.packages.map((p) => p.relativePath).sort();
    expect(paths).toContain('applications/portal');
    expect(paths).toContain('libraries/utils');
  });

  it('detects Nx projects via legacy workspace.json projects map', async () => {
    await writeJson('nx.json', {});
    await writeJson('workspace.json', {
      projects: {
        legacyApp: 'apps/legacy-app',
        legacyLib: { root: 'libs/legacy-lib' },
      },
    });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('nx');
    const names = info.packages.map((p) => p.name).sort();
    expect(names).toContain('legacyApp');
    expect(names).toContain('legacyLib');
  });

  it('treats turbo.json as a marker that falls back to packages/* + apps/*', async () => {
    await writeJson('turbo.json', { pipeline: {} });
    await writeJson('packages/core/package.json', { name: 'core' });
    await writeJson('apps/web/package.json', { name: 'web' });
    const info = await detectWorkspaces(tmp);
    expect(info.kind).toBe('turbo');
    const names = info.packages.map((p) => p.name).sort();
    expect(names).toContain('core');
    expect(names).toContain('web');
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
