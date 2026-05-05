import { describe, it, expect } from 'vitest';
import { attachCostSidecar, estimateTokens } from '../../src/mcp/tokenBudget.js';

describe('attachCostSidecar (1.5+)', () => {
  it('attaches a _cost sidecar to plain objects', () => {
    const out = attachCostSidecar({ foo: 'bar' }, 100) as {
      foo: string;
      _cost: { estimatedTokens: number };
    };
    expect(out.foo).toBe('bar');
    expect(out._cost.estimatedTokens).toBe(100);
  });

  it('wraps arrays without spreading them into key-value chaos', () => {
    const out = attachCostSidecar([1, 2, 3], 50) as {
      value: number[];
      _cost: { estimatedTokens: number };
    };
    expect(Array.isArray(out.value)).toBe(true);
    expect(out.value).toEqual([1, 2, 3]);
    expect(out._cost.estimatedTokens).toBe(50);
  });

  it('wraps primitives', () => {
    const num = attachCostSidecar(42, 5) as { value: number; _cost: { estimatedTokens: number } };
    expect(num.value).toBe(42);
    expect(num._cost.estimatedTokens).toBe(5);

    const str = attachCostSidecar('hi', 1) as { value: string; _cost: { estimatedTokens: number } };
    expect(str.value).toBe('hi');
  });

  it('wraps null', () => {
    const out = attachCostSidecar(null, 1) as { value: null; _cost: { estimatedTokens: number } };
    expect(out.value).toBeNull();
  });

  it('lifts a top-level `tier` field into the sidecar', () => {
    const out = attachCostSidecar({ tier: 'summary', verdict: 'ok' }, 1500) as {
      tier: string;
      verdict: string;
      _cost: { estimatedTokens: number; tier: string };
    };
    expect(out._cost.tier).toBe('summary');
    // `tier` stays at top level too — it's an additive sidecar, not a move.
    expect(out.tier).toBe('summary');
  });
});

describe('estimateTokens', () => {
  it('uses the chars/4 heuristic', () => {
    expect(estimateTokens('1234')).toBe(1);
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });
});
