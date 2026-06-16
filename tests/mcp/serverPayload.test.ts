import { describe, expect, it } from 'vitest';
import { applyToolBudgetAndCost, formatToolContent } from '../../src/mcp/serverPayload.js';

describe('serverPayload', () => {
  it('attaches cost sidecar without a budget sidecar when payload fits', () => {
    const { payload, estimatedTokens } = applyToolBudgetAndCost({ ok: true, tier: 'summary' }, {});

    const out = payload as {
      ok: boolean;
      tier: string;
      _cost: { estimatedTokens: number; tier?: string };
      _budget?: unknown;
    };

    expect(out.ok).toBe(true);
    expect(out._budget).toBeUndefined();
    expect(out._cost.estimatedTokens).toBe(estimatedTokens);
    expect(out._cost.tier).toBe('summary');
  });

  it('wraps truncated array payloads without spreading numeric keys', () => {
    const result = Array.from({ length: 40 }, (_, index) => ({
      index,
      text: 'x'.repeat(50),
    }));

    const { payload } = applyToolBudgetAndCost(result, { max_tokens: 20 });

    const out = payload as {
      value: unknown[];
      _budget: { truncated: boolean; maxTokens?: number };
      _cost: { estimatedTokens: number };
    };

    expect(Array.isArray(out.value)).toBe(true);
    expect(out._budget.truncated).toBe(true);
    expect(out._budget.maxTokens).toBe(20);
    expect(Object.keys(out).filter((key) => /^\d+$/.test(key))).toEqual([]);
  });

  it('formats stream content as chunked content blocks', () => {
    const payload = {
      entries: Array.from({ length: 55 }, (_, index) => ({ index })),
      total: 55,
    };

    const blocks = formatToolContent(payload, true) as Array<{ type: string; text: string }>;

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => block.type === 'text')).toBe(true);
    const header = JSON.parse(blocks[0].text) as Record<string, unknown>;
    expect(header.entriesPreview).toMatchObject({ totalItems: 55 });
  });

  it('falls back to String(value) for circular non-stream payloads', () => {
    const payload: Record<string, unknown> = {};
    payload.self = payload;

    const blocks = formatToolContent(payload, false) as Array<{ type: string; text: string }>;

    expect(blocks).toEqual([{ type: 'text', text: '[object Object]' }]);
  });
});
