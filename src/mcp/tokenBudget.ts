/**
 * Rough token estimator and record-aware truncator for MCP tool output.
 *
 * Uses the widely-used "~4 chars per token" heuristic. Good enough for
 * prioritization — absolute accuracy is not required.
 */

export const CHARS_PER_TOKEN = 4;

export function estimateTokens(value: string): number {
  return Math.ceil(value.length / CHARS_PER_TOKEN);
}

export interface BudgetOptions {
  /** Max tokens allowed in the serialized output. */
  maxTokens?: number;
  /** Treat arrays at these paths (e.g. "entries", "hotspots") as truncatable. */
  truncatablePaths?: string[];
}

export interface BudgetResult<T> {
  value: T;
  truncated: boolean;
  estimatedTokens: number;
}

/**
 * Apply a token budget to a structured result. If the JSON-serialized form
 * fits within maxTokens, return as-is. Otherwise, walk truncatable array
 * fields and trim them until we fit (or give up and mark truncated).
 */
export function applyBudget<T>(
  value: T,
  options: BudgetOptions = {},
): BudgetResult<T> {
  const maxTokens = options.maxTokens;
  if (!maxTokens || maxTokens <= 0) {
    return {
      value,
      truncated: false,
      estimatedTokens: estimateTokens(safeStringify(value)),
    };
  }

  let current = value;
  let serialized = safeStringify(current);
  let tokens = estimateTokens(serialized);

  if (tokens <= maxTokens) {
    return { value: current, truncated: false, estimatedTokens: tokens };
  }

  // Try trimming truncatable arrays progressively: halve each step.
  const paths = options.truncatablePaths ?? findArrayPaths(current);
  if (paths.length === 0) {
    return { value: current, truncated: true, estimatedTokens: tokens };
  }

  let attempt = 0;
  while (tokens > maxTokens && attempt < 20) {
    current = trimArrays(current, paths, 0.5);
    serialized = safeStringify(current);
    tokens = estimateTokens(serialized);
    attempt++;
  }

  return {
    value: current,
    truncated: tokens > maxTokens || attempt > 0,
    estimatedTokens: tokens,
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

/**
 * Find top-level array field names — our convention is that MCP results
 * expose a primary array (hotspots, entries, findings, files) worth
 * trimming before scalar fields.
 */
function findArrayPaths(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const paths: string[] = [];
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) paths.push(key);
  }
  return paths;
}

/**
 * Shrink arrays at the given paths by the factor (0–1). Preserves shape.
 * Returns a new object, does not mutate.
 */
function trimArrays<T>(value: T, paths: string[], factor: number): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const clone = { ...(value as Record<string, unknown>) };
  for (const key of paths) {
    const arr = clone[key];
    if (Array.isArray(arr) && arr.length > 1) {
      const keep = Math.max(1, Math.floor(arr.length * factor));
      clone[key] = arr.slice(0, keep);
    }
  }
  return clone as T;
}
