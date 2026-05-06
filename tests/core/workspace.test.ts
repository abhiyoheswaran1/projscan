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

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-workspace-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('loadWorkspace', () => {
  it('returns null when no workspace file exists', async () => {
    const w = await loadWorkspace(tmp);
    expect(w).toBeNull();
  });

  it('returns null on corrupt JSON', async () => {
    await fs.writeFile(path.join(tmp, '.projscan-workspace.json'), '{not json', 'utf-8');
    const w = await loadWorkspace(tmp);
    expect(w).toBeNull();
  });

  it('returns null on unknown schema version', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscan-workspace.json'),
      JSON.stringify({
        schemaVersion: 999,
        createdAt: new Date().toISOString(),
        repos: [{ path: '/foo', name: 'foo' }],
      }),
    );
    const w = await loadWorkspace(tmp);
    expect(w).toBeNull();
  });

  it('returns the workspace on a valid file', async () => {
    const valid = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      repos: [{ path: '/some/sibling', name: 'sibling' }],
    };
    await fs.writeFile(path.join(tmp, '.projscan-workspace.json'), JSON.stringify(valid));
    const w = await loadWorkspace(tmp);
    expect(w).not.toBeNull();
    expect(w?.repos).toHaveLength(1);
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
  it('round-trips repos', async () => {
    const w = await loadOrCreateWorkspace(tmp);
    addRepo(w, '/Users/abhyoh/code/sdk');
    addRepo(w, '/Users/abhyoh/code/consumer-a', 'app-a');
    await saveWorkspace(tmp, w);

    const reloaded = await loadWorkspace(tmp);
    expect(reloaded?.repos).toHaveLength(2);
    expect(reloaded?.repos.map((r) => r.name).sort()).toEqual(['app-a', 'sdk']);
  });
});
