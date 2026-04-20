/**
 * Split large tool responses into multiple MCP `content` blocks so agents
 * that consume them streaming-style can process results incrementally.
 *
 * MCP content is `[{ type: "text", text: string }, ...]`. Current strategy:
 *   - If the payload has a primary array field (hotspots, entries, findings,
 *     packages, matches), emit one header block with scalar fields, then
 *     emit chunk blocks each containing a slice of the array.
 *   - Otherwise, emit a single block.
 *
 * Chunk size defaults to 20 records per block — small enough to be a
 * meaningful streaming unit, big enough to avoid pathological block counts.
 */

const DEFAULT_CHUNK_SIZE = 20;
const PRIMARY_ARRAY_KEYS = [
  'hotspots',
  'entries',
  'findings',
  'packages',
  'matches',
  'importers',
  'files',
  'definedIn',
];

export interface ContentBlock {
  type: 'text';
  text: string;
}

export interface ChunkOptions {
  chunkSize?: number;
  /** Only chunk when the primary array has at least this many items. */
  minItemsToChunk?: number;
}

export function toContentBlocks(value: unknown, options: ChunkOptions = {}): ContentBlock[] {
  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const minItemsToChunk = options.minItemsToChunk ?? chunkSize;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ type: 'text', text: safeStringify(value) }];
  }

  const obj = value as Record<string, unknown>;
  const primaryKey = PRIMARY_ARRAY_KEYS.find(
    (k) => Array.isArray(obj[k]) && (obj[k] as unknown[]).length >= minItemsToChunk,
  );

  if (!primaryKey) {
    return [{ type: 'text', text: safeStringify(value) }];
  }

  const items = obj[primaryKey] as unknown[];
  const header: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === primaryKey) continue;
    header[k] = v;
  }
  header[`${primaryKey}Preview`] = {
    totalItems: items.length,
    chunkedInto: Math.ceil(items.length / chunkSize),
    chunkSize,
  };

  const blocks: ContentBlock[] = [{ type: 'text', text: safeStringify(header) }];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunkIndex = Math.floor(i / chunkSize);
    const chunkPayload = {
      _chunk: { index: chunkIndex, offset: i, size: items.slice(i, i + chunkSize).length },
      [primaryKey]: items.slice(i, i + chunkSize),
    };
    blocks.push({ type: 'text', text: safeStringify(chunkPayload) });
  }
  return blocks;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
