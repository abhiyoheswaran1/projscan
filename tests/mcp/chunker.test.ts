import { describe, it, expect } from 'vitest';
import { toContentBlocks } from '../../src/mcp/chunker.js';

describe('toContentBlocks', () => {
  it('returns a single block for non-object / primitive values', () => {
    expect(toContentBlocks('hello')).toHaveLength(1);
    expect(toContentBlocks(42)).toHaveLength(1);
    expect(toContentBlocks(null)).toHaveLength(1);
  });

  it('returns a single block when no primary array is large enough', () => {
    const value = { hotspots: [{ a: 1 }], meta: 'ok' };
    const blocks = toContentBlocks(value);
    expect(blocks).toHaveLength(1);
    const parsed = JSON.parse(blocks[0].text) as Record<string, unknown>;
    expect(parsed.hotspots).toBeDefined();
  });

  it('splits a large primary array into header + chunk blocks', () => {
    const hotspots = Array.from({ length: 55 }, (_, i) => ({ file: `f${i}`, score: i }));
    const value = { hotspots, total: 55 };
    const blocks = toContentBlocks(value, { chunkSize: 20, minItemsToChunk: 20 });

    // Expect 1 header + 3 chunks (55 / 20 = 3)
    expect(blocks).toHaveLength(4);
    const header = JSON.parse(blocks[0].text) as Record<string, unknown>;
    expect(header.total).toBe(55);
    expect(header.hotspots).toBeUndefined();
    expect(header.hotspotsPreview).toMatchObject({ totalItems: 55, chunkedInto: 3, chunkSize: 20 });

    const chunk0 = JSON.parse(blocks[1].text) as { hotspots: unknown[]; _chunk: { index: number; offset: number; size: number } };
    expect(chunk0.hotspots).toHaveLength(20);
    expect(chunk0._chunk).toEqual({ index: 0, offset: 0, size: 20 });

    const chunk2 = JSON.parse(blocks[3].text) as { hotspots: unknown[]; _chunk: { index: number; offset: number; size: number } };
    expect(chunk2.hotspots).toHaveLength(15);
    expect(chunk2._chunk).toEqual({ index: 2, offset: 40, size: 15 });
  });

  it('picks the first recognized primary array when multiple match', () => {
    const value = {
      hotspots: new Array(30).fill({ a: 1 }),
      entries: new Array(30).fill({ b: 2 }),
    };
    const blocks = toContentBlocks(value, { chunkSize: 10, minItemsToChunk: 10 });
    const header = JSON.parse(blocks[0].text) as Record<string, unknown>;
    expect(header.hotspotsPreview).toBeDefined();
    expect(header.entries).toBeDefined(); // non-primary arrays stay in the header
  });
});
