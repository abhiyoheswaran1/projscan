import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { costSummaryTool } from '../../src/mcp/tools/costSummary.js';

async function withTempRepo<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(tmpdir(), 'projscan-cost-'));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function plantSession(
  root: string,
  events: { kind: string; data?: Record<string, unknown> }[],
): Promise<void> {
  await mkdir(path.join(root, '.projscan-cache'), { recursive: true });
  const now = new Date().toISOString();
  const session = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    startedAt: now,
    lastActivityAt: now,
    touchedFiles: {},
    events: events.map((e) => ({ at: now, kind: e.kind, ...(e.data ? { data: e.data } : {}) })),
  };
  await writeFile(path.join(root, '.projscan-cache', 'session.json'), JSON.stringify(session));
}

describe('projscan_cost_summary', () => {
  it('returns zero totals for an empty session', async () => {
    await withTempRepo(async (root) => {
      const result = (await costSummaryTool.handler({}, root)) as Record<string, unknown>;
      expect(result.totalCalls).toBe(0);
      expect(result.totalEstimatedTokens).toBe(0);
      expect(result.averageTokens).toBe(0);
      expect(result.topSpenders).toEqual([]);
      expect(result.perToolCatalog).toEqual([]);
    });
  });

  it('aggregates per-tool token counts and ranks top spenders', async () => {
    await withTempRepo(async (root) => {
      await plantSession(root, [
        { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 4000 } },
        { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 5000 } },
        { kind: 'tool-call:projscan_review', data: { estimatedTokens: 7000 } },
        { kind: 'tool-call:projscan_search', data: { estimatedTokens: 1000 } },
        // Older event without cost data — should be ignored.
        { kind: 'tool-call:projscan_hotspots' },
      ]);
      const result = (await costSummaryTool.handler({}, root)) as Record<string, unknown>;
      expect(result.totalCalls).toBe(4);
      expect(result.totalEstimatedTokens).toBe(17000);
      const topSpenders = result.topSpenders as Array<{ tool: string; totalTokens: number }>;
      expect(topSpenders[0].tool).toBe('projscan_doctor');
      expect(topSpenders[0].totalTokens).toBe(9000);
      expect(topSpenders[1].tool).toBe('projscan_review');
    });
  });

  it('includes a static expectedTokens for known tools', async () => {
    await withTempRepo(async (root) => {
      await plantSession(root, [
        { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 4000 } },
      ]);
      const result = (await costSummaryTool.handler({}, root)) as Record<string, unknown>;
      const catalog = result.perToolCatalog as Array<{
        tool: string;
        observedTypicalTokens: number;
        expectedTokens: number | null;
      }>;
      const entry = catalog.find((c) => c.tool === 'projscan_doctor');
      expect(entry).toBeDefined();
      expect(entry!.observedTypicalTokens).toBe(4000);
      expect(typeof entry!.expectedTokens).toBe('number');
    });
  });

  it('reports null p95 with insufficientSamples=true for fewer than 20 calls', async () => {
    await withTempRepo(async (root) => {
      await plantSession(root, [
        { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 4000 } },
        { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 5000 } },
      ]);
      const result = (await costSummaryTool.handler({}, root)) as Record<string, unknown>;
      const catalog = result.perToolCatalog as Array<{
        tool: string;
        observedP95Tokens: number | null;
        observedP95InsufficientSamples: boolean;
      }>;
      const entry = catalog.find((c) => c.tool === 'projscan_doctor')!;
      expect(entry.observedP95Tokens).toBeNull();
      expect(entry.observedP95InsufficientSamples).toBe(true);
    });
  });

  it('reports a real p95 once samples reach 20', async () => {
    await withTempRepo(async (root) => {
      const events = [];
      for (let i = 0; i < 25; i++) {
        events.push({
          kind: 'tool-call:projscan_doctor',
          data: { estimatedTokens: 1000 + i * 100 },
        });
      }
      await plantSession(root, events);
      const result = (await costSummaryTool.handler({}, root)) as Record<string, unknown>;
      const catalog = result.perToolCatalog as Array<{
        tool: string;
        observedP95Tokens: number | null;
        observedP95InsufficientSamples: boolean;
      }>;
      const entry = catalog.find((c) => c.tool === 'projscan_doctor')!;
      expect(entry.observedP95Tokens).not.toBeNull();
      expect(entry.observedP95InsufficientSamples).toBe(false);
    });
  });

  it('respects the `top` argument', async () => {
    await withTempRepo(async (root) => {
      const events = [];
      for (let i = 0; i < 12; i++) {
        events.push({ kind: `tool-call:tool_${i}`, data: { estimatedTokens: i * 100 } });
      }
      await plantSession(root, events);
      const result = (await costSummaryTool.handler({ top: 3 }, root)) as Record<string, unknown>;
      const topSpenders = result.topSpenders as Array<{ tool: string }>;
      expect(topSpenders).toHaveLength(3);
      expect(topSpenders[0].tool).toBe('tool_11');
    });
  });

  it('clamps non-positive `top` to a sensible default', async () => {
    await withTempRepo(async (root) => {
      await plantSession(root, [
        { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 4000 } },
      ]);
      const result = (await costSummaryTool.handler({ top: 0 }, root)) as Record<string, unknown>;
      expect((result.topSpenders as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('live cost-summary streaming (1.10+)', () => {
    function mockContext() {
      const notifications: Array<{ method: string; params: Record<string, unknown> }> = [];
      const registered = new Map<string, () => void>();
      let counter = 0;
      return {
        notifications,
        registered,
        ctx: {
          notify: (method: string, params: Record<string, unknown>) => {
            notifications.push({ method, params });
            return true;
          },
          registerWatch: (cancel: () => void) => {
            const id = `stream-${++counter}`;
            registered.set(id, cancel);
            return id;
          },
          unregisterWatch: (id: string) => {
            const cancel = registered.get(id);
            if (!cancel) return false;
            cancel();
            registered.delete(id);
            return true;
          },
        },
      };
    }

    it('returns registered:false when no notify channel is available', async () => {
      await withTempRepo(async (root) => {
        const result = (await costSummaryTool.handler({ action: 'start_stream' }, root)) as Record<
          string,
          unknown
        >;
        expect(result.registered).toBe(false);
        expect(result.streamId).toBeNull();
      });
    });

    it('returns a streamId and baseline aggregates on start_stream', async () => {
      await withTempRepo(async (root) => {
        await plantSession(root, [
          { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 4000 } },
          { kind: 'tool-call:projscan_doctor', data: { estimatedTokens: 5000 } },
        ]);
        const { ctx } = mockContext();
        const result = (await costSummaryTool.handler(
          { action: 'start_stream', interval_seconds: 2 },
          root,
          ctx,
        )) as Record<string, unknown>;
        expect(result.registered).toBe(true);
        expect(typeof result.streamId).toBe('string');
        expect(result.intervalSeconds).toBe(2);
        expect((result.baseline as Record<string, number>).totalCalls).toBe(2);
        expect((result.baseline as Record<string, number>).totalEstimatedTokens).toBe(9000);
        // Stop the stream so the dangling timer doesn't keep the test alive.
        await costSummaryTool.handler(
          { action: 'stop_stream', stream_id: result.streamId },
          root,
          ctx,
        );
      });
    });

    it('list_streams enumerates active streams; stop_stream cancels by id', async () => {
      await withTempRepo(async (root) => {
        const { ctx } = mockContext();
        const start = (await costSummaryTool.handler(
          { action: 'start_stream', interval_seconds: 2 },
          root,
          ctx,
        )) as Record<string, unknown>;
        const list1 = (await costSummaryTool.handler(
          { action: 'list_streams' },
          root,
          ctx,
        )) as Record<string, unknown>;
        expect((list1.streams as unknown[]).length).toBe(1);

        const stop = (await costSummaryTool.handler(
          { action: 'stop_stream', stream_id: start.streamId },
          root,
          ctx,
        )) as Record<string, unknown>;
        expect(stop.cancelled).toBe(true);

        const list2 = (await costSummaryTool.handler(
          { action: 'list_streams' },
          root,
          ctx,
        )) as Record<string, unknown>;
        expect((list2.streams as unknown[]).length).toBe(0);
      });
    });

    it('clamps interval_seconds below the minimum', async () => {
      await withTempRepo(async (root) => {
        const { ctx } = mockContext();
        const result = (await costSummaryTool.handler(
          { action: 'start_stream', interval_seconds: 0.1 },
          root,
          ctx,
        )) as Record<string, unknown>;
        // MIN_STREAM_INTERVAL_S = 2
        expect(result.intervalSeconds).toBe(2);
        await costSummaryTool.handler(
          { action: 'stop_stream', stream_id: result.streamId },
          root,
          ctx,
        );
      });
    });

    it('rejects unknown action with an error', async () => {
      await withTempRepo(async (root) => {
        const { ctx } = mockContext();
        await expect(
          costSummaryTool.handler({ action: 'totally-not-a-thing' }, root, ctx),
        ).rejects.toThrow(/Unknown action/);
      });
    });
  });
});
