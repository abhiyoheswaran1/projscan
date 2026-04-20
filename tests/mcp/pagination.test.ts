import { describe, it, expect } from 'vitest';
import { paginate, encodeCursor, decodeCursor, listChecksum } from '../../src/mcp/pagination.js';

describe('pagination', () => {
  it('returns first page without a cursor', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const page = paginate(items, { pageSize: 20 }, listChecksum(items));
    expect(page.items).toEqual(items.slice(0, 20));
    expect(page.total).toBe(100);
    expect(page.nextCursor).toBeDefined();
  });

  it('advances through pages using nextCursor', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const checksum = listChecksum(items);
    const first = paginate(items, { pageSize: 20 }, checksum);
    expect(first.items).toEqual(items.slice(0, 20));

    const second = paginate(items, { cursor: first.nextCursor, pageSize: 20 }, checksum);
    expect(second.items).toEqual(items.slice(20, 40));

    const third = paginate(items, { cursor: second.nextCursor, pageSize: 20 }, checksum);
    expect(third.items).toEqual(items.slice(40, 50));
    expect(third.nextCursor).toBeUndefined();
  });

  it('resets to offset=0 when checksum mismatches (list shape changed)', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const first = paginate(items, { pageSize: 20 }, 'len:50');

    // Simulate shape change
    const trimmed = items.slice(0, 10);
    const second = paginate(trimmed, { cursor: first.nextCursor, pageSize: 20 }, listChecksum(trimmed));
    expect(second.items).toEqual(trimmed);
  });

  it('clamps pageSize to safe bounds', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const p1 = paginate(items, { pageSize: 0 }, listChecksum(items));
    expect(p1.items.length).toBe(1);
    const p2 = paginate(items, { pageSize: 10_000 }, listChecksum(items));
    expect(p2.items.length).toBe(10);
  });

  it('decodeCursor rejects garbage input', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('not-base64!@#')).toBeNull();
    expect(decodeCursor(encodeCursor({ offset: 5, checksum: 'x' }))).toEqual({ offset: 5, checksum: 'x' });
  });
});
