import { describe, it, expect } from 'vitest';
import { applyBudget, estimateTokens } from '../../src/mcp/tokenBudget.js';

describe('estimateTokens', () => {
  it('approximates ~4 chars per token', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('x'.repeat(400))).toBe(100);
  });
});

describe('applyBudget', () => {
  it('passes through when no maxTokens is set', () => {
    const value = { entries: new Array(100).fill({ x: 1 }) };
    const r = applyBudget(value);
    expect(r.truncated).toBe(false);
    expect((r.value as { entries: unknown[] }).entries).toHaveLength(100);
  });

  it('truncates array fields when over budget', () => {
    const value = {
      entries: new Array(100).fill(0).map((_, i) => ({ id: i, blob: 'x'.repeat(50) })),
    };
    const r = applyBudget(value, { maxTokens: 100 });
    expect(r.truncated).toBe(true);
    expect((r.value as { entries: unknown[] }).entries.length).toBeLessThan(100);
    expect(r.estimatedTokens).toBeLessThanOrEqual(200);
  });

  it('preserves non-array scalars', () => {
    const value = {
      summary: 'hello world',
      entries: new Array(200).fill({ x: 'x'.repeat(20) }),
    };
    const r = applyBudget(value, { maxTokens: 50 });
    expect((r.value as { summary: string }).summary).toBe('hello world');
    expect((r.value as { entries: unknown[] }).entries.length).toBeLessThan(200);
  });

  it('passes through small payloads', () => {
    const value = { entries: [{ a: 1 }, { a: 2 }] };
    const r = applyBudget(value, { maxTokens: 10_000 });
    expect(r.truncated).toBe(false);
    expect((r.value as { entries: unknown[] }).entries).toHaveLength(2);
  });
});
