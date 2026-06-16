import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadWorkspace,
  loadOrCreateWorkspace,
  addRepo,
  removeRepo,
  saveWorkspace,
  WORKSPACE_SCHEMA_VERSION,
} from '../../src/core/workspace.js';

let tmp: string;
let base: string;

beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-workspace-base-'));
  tmp = path.join(base, 'root');
  await fs.mkdir(tmp, { recursive: true });
});

afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

describe('loadWorkspace', () => {
  it('returns null when no trusted local workspace file exists', async () => {
    const w = await loadWorkspace(tmp);
    expect(w).toBeNull();
  });

  it('ignores legacy checked-in workspace files at the project root', async () => {
    const sibling = await makeSiblingRepo('legacy-sibling');
    await fs.writeFile(
      path.join(tmp, '.projscan-workspace.json'),
      JSON.stringify({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        repos: [{ path: sibling, name: 'legacy-sibling' }],
      }),
    );

    const w = await loadWorkspace(tmp);

    expect(w).toBeNull();
  });

  it('returns null on corrupt JSON', async () => {
    await writeTrustedWorkspace('{not json');
    const w = await loadWorkspace(tmp);
    expect(w).toBeNull();
  });

  it('returns null on unknown schema version', async () => {
    const sibling = await makeSiblingRepo('sibling');
    await writeTrustedWorkspace(
      JSON.stringify({
        schemaVersion: 999,
        createdAt: new Date().toISOString(),
        repos: [{ path: sibling, name: 'sibling' }],
      }),
    );
    const w = await loadWorkspace(tmp);
    expect(w).toBeNull();
  });

  it('returns the workspace on a valid trusted local file', async () => {
    const sibling = await makeSiblingRepo('sibling');
    await writeTrustedWorkspace(
      JSON.stringify({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        repos: [{ path: sibling, name: 'sibling' }],
      }),
    );

    const w = await loadWorkspace(tmp);

    expect(w).not.toBeNull();
    expect(w?.repos).toHaveLength(1);
    expect(w?.repos[0].path).toBe(await fs.realpath(sibling));
  });

  it('filters repos that are outside the sibling workspace boundary', async () => {
    const sibling = await makeSiblingRepo('sibling');
    const nestedOutside = path.join(base, 'nested', 'sensitive');
    await fs.mkdir(nestedOutside, { recursive: true });
    await writeTrustedWorkspace(
      JSON.stringify({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        repos: [
          { path: sibling, name: 'sibling' },
          { path: nestedOutside, name: 'sensitive' },
        ],
      }),
    );

    const w = await loadWorkspace(tmp);

    expect(w?.repos).toEqual([{ path: await fs.realpath(sibling), name: 'sibling' }]);
  });

  it('caps trusted workspace repos before cross-repo scans consume them', async () => {
    const repos = [];
    for (let i = 0; i < 25; i += 1) {
      const repoPath = await makeSiblingRepo(`repo-${i}`);
      repos.push({ path: repoPath, name: `repo-${i}` });
    }
    await writeTrustedWorkspace(
      JSON.stringify({
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        repos,
      }),
    );

    const w = await loadWorkspace(tmp);

    expect(w?.repos).toHaveLength(20);
    expect(w?.repos[0].name).toBe('repo-0');
    expect(w?.repos[19].name).toBe('repo-19');
  });
});

describe('loadOrCreateWorkspace', () => {
  it('creates a fresh empty workspace when file is absent', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    expect(w.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(w.repos).toEqual([]);
    expect(typeof w.createdAt).toBe('string');
  });
});

describe('addRepo', () => {
  it('appends a new repo with a defaulted name (basename)', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    const entry = addRepo(w, '/Users/abhyoh/code/sdk');
    expect(entry.path).toBe('/Users/abhyoh/code/sdk');
    expect(entry.name).toBe('sdk');
    expect(w.repos).toHaveLength(1);
  });

  it('honors an explicit name', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/some-repo', 'my-sdk');
    expect(w.repos[0].name).toBe('my-sdk');
  });

  it('resolves relative paths to absolute', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    const entry = addRepo(w, './relative/path');
    expect(path.isAbsolute(entry.path)).toBe(true);
  });

  it('rejects duplicate registration by path', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/sdk');
    expect(() => addRepo(w, '/Users/abhyoh/code/sdk')).toThrow(/already registered/);
  });

  it('rejects duplicate registration by name', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/sdk-a', 'sdk');
    expect(() => addRepo(w, '/Users/abhyoh/code/sdk-b', 'sdk')).toThrow(/already registered/);
  });

  it('rejects empty path', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    expect(() => addRepo(w, '')).toThrow(/required/);
  });
});

describe('removeRepo', () => {
  it('removes a repo by absolute path', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/sdk');
    const removed = removeRepo(w, '/Users/abhyoh/code/sdk');
    expect(removed?.name).toBe('sdk');
    expect(w.repos).toHaveLength(0);
  });

  it('removes a repo by name', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/some-repo', 'my-sdk');
    const removed = removeRepo(w, 'my-sdk');
    expect(removed?.path).toBe('/Users/abhyoh/code/some-repo');
  });

  it('returns null when no match', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/sdk');
    expect(removeRepo(w, 'never-existed')).toBeNull();
  });

  it('returns null on empty input', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    expect(removeRepo(w, '')).toBeNull();
  });
});

describe('saveWorkspace + reload roundtrip', () => {
  it('round-trips trusted sibling repos', async () => {
    const sdk = await makeSiblingRepo('sdk');
    const consumer = await makeSiblingRepo('consumer-a');
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, sdk);
    addRepo(w, consumer, 'app-a');
    await saveWorkspace(tmp, w);

    const reloaded = await loadWorkspace(tmp);
    expect(reloaded?.repos).toHaveLength(2);
    expect(reloaded?.repos.map((r) => r.name).sort()).toEqual(['app-a', 'sdk']);
    expect(reloaded?.repos.every((r) => path.isAbsolute(r.path))).toBe(true);
  });
});

async function makeSiblingRepo(name: string): Promise<string> {
  const repoPath = path.join(base, name);
  await fs.mkdir(repoPath, { recursive: true });
  return repoPath;
}

async function writeTrustedWorkspace(raw: string): Promise<void> {
  const trustedDir = path.join(tmp, '.projscan-cache');
  await fs.mkdir(trustedDir, { recursive: true });
  await fs.writeFile(path.join(trustedDir, 'workspace.json'), raw, 'utf-8');
}
