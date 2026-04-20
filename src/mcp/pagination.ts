/**
 * Cursor-based pagination for MCP tool responses.
 *
 * Cursors are opaque base64-encoded JSON objects containing an integer
 * offset plus an optional checksum of the result-set shape so we can
 * detect when the underlying data has shifted between paginated calls.
 *
 * Agents pass `cursor` back to the same tool to fetch the next page.
 * When no more results exist, the response omits `nextCursor`.
 */

export interface PageRequest {
  cursor?: string;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
  total: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

/**
 * Slice an array into a page. `checksum` should be a cheap identifier of
 * the result-set shape (e.g., `items.length`) - if it mismatches a cursor's
 * captured checksum we treat the page as fresh (offset=0) rather than risk
 * returning stale offsets.
 */
export function paginate<T>(
  items: T[],
  request: PageRequest,
  checksum: string,
): Page<T> {
  const size = Math.max(1, Math.min(MAX_PAGE_SIZE, request.pageSize ?? DEFAULT_PAGE_SIZE));
  const decoded = decodeCursor(request.cursor);
  const offset = decoded && decoded.checksum === checksum ? decoded.offset : 0;

  const slice = items.slice(offset, offset + size);
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < items.length;

  return {
    items: slice,
    nextCursor: hasMore ? encodeCursor({ offset: nextOffset, checksum }) : undefined,
    total: items.length,
  };
}

interface DecodedCursor {
  offset: number;
  checksum: string;
}

export function encodeCursor(cursor: DecodedCursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json, 'utf-8').toString('base64');
}

export function decodeCursor(cursor?: string): DecodedCursor | null {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as DecodedCursor;
    if (typeof parsed.offset !== 'number' || typeof parsed.checksum !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Compute a lightweight checksum for a list. Deliberately weak - we want
 * cursor invalidation on shape changes (length) but not on micro-changes
 * within items (scores that shift slightly between runs). Agents already
 * handle eventual consistency.
 */
export function listChecksum(items: unknown[]): string {
  return `len:${items.length}`;
}

/** Extract pageSize + cursor from MCP args, defaulting conservatively. */
export function readPageParams(args: Record<string, unknown>): PageRequest {
  const cursor = typeof args.cursor === 'string' ? args.cursor : undefined;
  const pageSize = typeof args.page_size === 'number' ? args.page_size : undefined;
  return { cursor, pageSize };
}
