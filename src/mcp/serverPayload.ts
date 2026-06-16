import { toContentBlocks } from './chunker.js';
import { applyBudget, attachCostSidecar, estimateTokens } from './tokenBudget.js';

export interface ToolPayloadBudgetResult {
  payload: unknown;
  estimatedTokens: number;
}

interface BudgetInfo {
  truncated: boolean;
  estimatedTokens: number;
  maxTokens?: number;
}

/**
 * Apply the agent's `max_tokens` budget (post-hoc truncation) then
 * attach the `_cost` sidecar reflecting the final payload.
 */
export function applyToolBudgetAndCost(
  result: unknown,
  args: Record<string, unknown>,
): ToolPayloadBudgetResult {
  const rawMaxTokens = args.max_tokens;
  const maxTokens =
    typeof rawMaxTokens === 'number' && Number.isFinite(rawMaxTokens) && rawMaxTokens > 0
      ? rawMaxTokens
      : undefined;
  const budgeted = applyBudget(result, maxTokens !== undefined ? { maxTokens } : {});
  const withBudget = budgeted.truncated
    ? attachBudgetSidecar(budgeted.value, {
        truncated: true,
        estimatedTokens: budgeted.estimatedTokens,
        maxTokens,
      })
    : budgeted.value;
  // Only the truncated branch wraps the budgeted value, changing the
  // serialized size. The common non-truncated path reuses applyBudget's
  // estimate instead of stringifying the full payload again.
  const finalEstimatedTokens = budgeted.truncated
    ? estimateTokens(JSON.stringify(withBudget) ?? '')
    : budgeted.estimatedTokens;
  return {
    payload: attachCostSidecar(withBudget, finalEstimatedTokens),
    estimatedTokens: finalEstimatedTokens,
  };
}

/**
 * Format the post-budget payload into MCP content blocks.
 */
export function formatToolContent(payload: unknown, wantsStreaming: boolean): unknown[] {
  return wantsStreaming
    ? toContentBlocks(payload)
    : [{ type: 'text', text: safeStringify(payload) }];
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Attach a _budget sidecar to the result. Arrays and primitives must be
 * wrapped rather than spread; object spread over an array yields a garbled
 * { "0": ..., "1": ..., _budget } object that breaks downstream consumers.
 */
function attachBudgetSidecar(value: unknown, info: BudgetInfo): unknown {
  if (Array.isArray(value)) {
    return { value, _budget: info };
  }
  if (value === null || typeof value !== 'object') {
    return { value, _budget: info };
  }
  return { ...(value as Record<string, unknown>), _budget: info };
}
