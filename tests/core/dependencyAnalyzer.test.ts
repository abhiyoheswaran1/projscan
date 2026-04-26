import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { analyzeDependencies } from '../../src/core/dependencyAnalyzer.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-deps-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

describe('analyzeDependencies (single-package)', () => {
  it('returns null when no package.json exists', async () => {
    const r = await analyzeDependencies(tmp);
    expect(r).toBeNull();
  });

  it('counts dependencies and devDependencies', async () => {
    await write(
      'package.json',
      JSON.stringify({
        name: 'x',
        dependencies: { lodash: '^4.0.0' },
        devDependencies: { vitest: '^1.0.0' },
      }),
    );
    const r = await analyzeDependencies(tmp);
    expect(r).not.toBeNull();
    expect(r!.totalDependencies).toBe(1);
    expect(r!.totalDevDependencies).toBe(1);
    // No `byWorkspace` for single-package repos.
    expect(r!.byWorkspace).toBeUndefined();
  });

  it('flags deprecated packages', async () => {
    await write(
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { moment: '^2.0.0' } }),
    );
    const r = await analyzeDependencies(tmp);
    const moment = r!.risks.find((rk) => rk.name === 'moment');
    expect(moment).toBeDefined();
    expect(moment!.severity).toBe('high');
  });
});

describe('analyzeDependencies (workspace-aware)', () => {
  async function setupMonorepo(): Promise<void> {
    await write(
      'package.json',
      JSON.stringify({
        name: 'root',
        workspaces: ['packages/*'],
        devDependencies: { vitest: '^1.0.0' },
      }),
    );
    await write(
      'packages/a/package.json',
      JSON.stringify({
        name: 'a',
        dependencies: { lodash: '^4.0.0' },
      }),
    );
    await write(
      'packages/b/package.json',
      JSON.stringify({
        name: 'b',
        dependencies: { moment: '^2.0.0' },
      }),
    );
  }

  it('aggregates root + workspaces and emits byWorkspace breakdown', async () => {
    await setupMonorepo();
    const r = await analyzeDependencies(tmp);
    expect(r).not.toBeNull();
    expect(r!.byWorkspace).toBeDefined();
    expect(r!.byWorkspace).toHaveLength(3); // root + a + b
    const names = r!.byWorkspace!.map((w) => w.workspace).sort();
    expect(names).toEqual(['a', 'b', 'root']);
    // Aggregate totals: lodash (a) + moment (b) = 2 prod deps; vitest = 1 dev dep.
    expect(r!.totalDependencies).toBe(2);
    expect(r!.totalDevDependencies).toBe(1);
  });

  it('attaches workspace name to risks raised in workspace manifests', async () => {
    await setupMonorepo();
    const r = await analyzeDependencies(tmp);
    const moment = r!.risks.find((rk) => rk.name === 'moment');
    expect(moment).toBeDefined();
    expect(moment!.workspace).toBe('b');
  });

  it('packageFilter scopes to a single workspace', async () => {
    await setupMonorepo();
    const r = await analyzeDependencies(tmp, { packageFilter: 'a' });
    expect(r).not.toBeNull();
    expect(r!.byWorkspace).toHaveLength(1);
    expect(r!.byWorkspace![0].workspace).toBe('a');
    expect(r!.totalDependencies).toBe(1);
  });

  it('returns null for a non-existent workspace filter', async () => {
    await setupMonorepo();
    const r = await analyzeDependencies(tmp, { packageFilter: 'nonexistent' });
    expect(r).toBeNull();
  });
});
