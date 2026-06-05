import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { coordinateWatchTool, __resetCoordinateWatchesForTests } from '../../src/mcp/tools/coordinateWatch.js';
import type { McpToolContext } from '../../src/mcp/tools/_shared.js';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

let root: string;

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'projscan-coord-watch-'));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');
  await mkdir(path.join(dir, 'src'), { recursive: true });
  await writeFile(path.join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  return dir;
}

/** Fake notify channel + watch registry, mirroring the MCP server's. */
function makeContext(): McpToolContext & { cancels: Map<string, () => void> } {
  const cancels = new Map<string, () => void>();
  let n = 0;
  return {
    cancels,
    notify: () => true,
    registerWatch: (cancel: () => void) => {
      const id = `watch-${++n}`;
      cancels.set(id, cancel);
      return id;
    },
    unregisterWatch: (id: string) => {
      const cancel = cancels.get(id);
      if (!cancel) return false;
      cancel();
      cancels.delete(id);
      return true;
    },
  };
}

beforeEach(async () => {
  __resetCoordinateWatchesForTests();
  root = await makeRepo();
});

afterEach(async () => {
  __resetCoordinateWatchesForTests();
  if (root) await rm(root, { recursive: true, force: true });
});

describe('projscan_coordinate_watch', () => {
  it('returns the initial summary and a non-registered watch when there is no notify channel', async () => {
    const result = (await coordinateWatchTool.handler({ action: 'start' }, root, undefined)) as {
      registered: boolean;
      watchId: string | null;
      report: { schemaVersion: number };
    };
    expect(result.registered).toBe(false);
    expect(result.watchId).toBeNull();
    expect(result.report.schemaVersion).toBe(1);
  });

  it('registers a watch and returns a watchId when a notify channel is present', async () => {
    const context = makeContext();
    const result = (await coordinateWatchTool.handler({ action: 'start', interval_seconds: 30 }, root, context)) as {
      registered: boolean;
      watchId: string;
    };
    expect(result.registered).toBe(true);
    expect(typeof result.watchId).toBe('string');
    expect(context.cancels.has(result.watchId)).toBe(true);
  });

  it('clamps interval_seconds to [5, 600]', async () => {
    const context = makeContext();
    const low = (await coordinateWatchTool.handler({ action: 'start', interval_seconds: 1 }, root, context)) as { intervalSeconds: number };
    expect(low.intervalSeconds).toBe(5);
    const high = (await coordinateWatchTool.handler({ action: 'start', interval_seconds: 100000 }, root, context)) as { intervalSeconds: number };
    expect(high.intervalSeconds).toBe(600);
  });

  it('lists and stops active watches', async () => {
    const context = makeContext();
    const start = (await coordinateWatchTool.handler({ action: 'start' }, root, context)) as { watchId: string };
    const list = (await coordinateWatchTool.handler({ action: 'list' }, root, context)) as {
      watches: Array<{ watchId: string }>;
    };
    expect(list.watches.map((w) => w.watchId)).toContain(start.watchId);

    const stop = (await coordinateWatchTool.handler({ action: 'stop', watchId: start.watchId }, root, context)) as { stopped: boolean };
    expect(stop.stopped).toBe(true);
    const afterList = (await coordinateWatchTool.handler({ action: 'list' }, root, context)) as { watches: unknown[] };
    expect(afterList.watches).toEqual([]);
  });
});
