import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  reviewWatchTool,
  __resetReviewWatchesForTests,
} from '../../src/mcp/tools/reviewWatch.js';
import type { McpToolContext } from '../../src/mcp/tools/_shared.js';

const GIT_WATCH_TIMEOUT_MS = 60000;

vi.setConfig({ testTimeout: GIT_WATCH_TIMEOUT_MS, hookTimeout: GIT_WATCH_TIMEOUT_MS });

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'projscan-watch-'));
  execSync('git init -q', { cwd: root });
  execSync('git config user.email "t@example.com"', { cwd: root });
  execSync('git config user.name "T"', { cwd: root });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src/a.js'), 'export function a() { return 1; }\n');
  execSync('git add -A && git commit -q -m initial', { cwd: root });
  return root;
}

describe('projscan_review_watch — start (without notify channel)', () => {
  let root: string;

  beforeAll(async () => {
    root = await makeRepo();
  });

  beforeEach(() => __resetReviewWatchesForTests());

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('returns the initial review and a non-registered watch when notify is unavailable', async () => {
    const result = (await reviewWatchTool.handler(
      { action: 'start', base: 'HEAD', head: 'HEAD' },
      root,
    )) as Record<string, unknown>;
    expect(result.action).toBe('start');
    expect(result.registered).toBe(false);
    expect(result.watchId).toBeNull();
    expect(result.report).toBeDefined();
  });
});

describe('projscan_review_watch — start (with notify + registry)', () => {
  let root: string;
  let watchCancels: Map<string, () => void>;
  let context: McpToolContext;

  beforeAll(async () => {
    root = await makeRepo();
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  beforeEach(() => {
    __resetReviewWatchesForTests();
    watchCancels = new Map();
    context = {
      notify: () => true,
      registerWatch: (cancel) => {
        const id = `w-${watchCancels.size + 1}`;
        watchCancels.set(id, cancel);
        return id;
      },
      unregisterWatch: (id) => {
        const cancel = watchCancels.get(id);
        if (!cancel) return false;
        cancel();
        watchCancels.delete(id);
        return true;
      },
    };
  });

  afterEach(async () => {
    for (const cancel of watchCancels.values()) cancel();
  });

  it('registers a watch and returns a watchId', async () => {
    const result = (await reviewWatchTool.handler(
      { action: 'start', base: 'HEAD', head: 'HEAD', interval_seconds: 60 },
      root,
      context,
    )) as Record<string, unknown>;
    expect(result.registered).toBe(true);
    expect(typeof result.watchId).toBe('string');
    expect((result.watchId as string).length).toBeGreaterThan(0);
    expect(result.report).toBeDefined();
  });

  it('clamps interval_seconds to the [5, 600] range', async () => {
    const lower = (await reviewWatchTool.handler(
      { action: 'start', base: 'HEAD', head: 'HEAD', interval_seconds: 1 },
      root,
      context,
    )) as Record<string, unknown>;
    expect(lower.intervalSeconds).toBe(5);
    const upper = (await reviewWatchTool.handler(
      { action: 'start', base: 'HEAD', head: 'HEAD', interval_seconds: 100000 },
      root,
      context,
    )) as Record<string, unknown>;
    expect(upper.intervalSeconds).toBe(600);
  });

  it('lists active watches', async () => {
    const start = (await reviewWatchTool.handler(
      { action: 'start', base: 'HEAD', head: 'HEAD' },
      root,
      context,
    )) as Record<string, unknown>;
    const list = (await reviewWatchTool.handler(
      { action: 'list' },
      root,
      context,
    )) as Record<string, unknown>;
    expect(list.count).toBe(1);
    expect((list.watches as Array<{ watchId: string }>)[0].watchId).toBe(start.watchId);
  });

  it('stops a watch by watchId', async () => {
    const start = (await reviewWatchTool.handler(
      { action: 'start', base: 'HEAD', head: 'HEAD' },
      root,
      context,
    )) as Record<string, unknown>;
    const stop = (await reviewWatchTool.handler(
      { action: 'stop', watchId: start.watchId },
      root,
      context,
    )) as Record<string, unknown>;
    expect(stop.cancelled).toBe(true);
    const list = (await reviewWatchTool.handler(
      { action: 'list' },
      root,
      context,
    )) as Record<string, unknown>;
    expect(list.count).toBe(0);
  });

  it('rejects unknown action', async () => {
    await expect(
      reviewWatchTool.handler({ action: 'unknown' }, root, context),
    ).rejects.toThrow(/Unknown action/);
  });

  it('rejects stop without watchId', async () => {
    await expect(
      reviewWatchTool.handler({ action: 'stop' }, root, context),
    ).rejects.toThrow(/watchId/);
  });
});
