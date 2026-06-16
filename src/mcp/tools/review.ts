import { computeReview, selectReviewTier, shapeReviewForTier } from '../../core/review.js';
import { emitProgress } from '../progress.js';
import type { McpTool } from './_shared.js';

export const reviewTool: McpTool = {
  name: 'projscan_review',
  description:
    'One-call PR review. Combines projscan_pr_diff + per-changed-file risk score + new/expanded import cycles + risky function additions + dependency changes, plus a verdict ("ok" | "review" | "block") with a one-line summary. Use when an agent is asked "is this PR safe to merge?" Defaults: base=origin/main (falls back to main/master/HEAD~1), head=HEAD. Pass `max_cost_tokens` (1.5+) to get a budget-shaped response: <3000 returns verdict-only, <7000 returns a summary, otherwise the full review. 1.9+: pass `intent` (a free-text PR description like "refactor auth middleware" or "docs: fix codex setup") to get an intent-grounded review — each finding is labelled expected / unexpected / out-of-scope against the stated intent. Verdict is unchanged; this is an extra narration layer.',
  inputSchema: {
    type: 'object',
    properties: {
      base: {
        type: 'string',
        description:
          'Base ref (branch, tag, sha). Default: origin/main, falling back to main/master/HEAD~1.',
      },
      head: { type: 'string', description: 'Head ref. Default: HEAD.' },
      max_tokens: {
        type: 'number',
        description: 'Cap the response via post-hoc array trimming.',
      },
      max_cost_tokens: {
        type: 'number',
        description:
          '1.5+ — adaptive shape budget. Tool picks a tier based on this value: <3000 verdict-only, <7000 summary, otherwise full. Differs from `max_tokens` (post-hoc truncation): the tool reshapes the response BEFORE serializing, so an agent on a tight budget gets a response sized to fit instead of a truncated full one.',
      },
      package: {
        type: 'string',
        description:
          'Optional. Workspace package name to scope all sections of the review to a single package.',
      },
      intent: {
        type: 'string',
        description:
          '1.9+ — free-text description of what the PR is trying to do. projscan parses this into an action (feature / fix / refactor / perf / test / docs / chore / remove) plus scope tokens, then labels every finding as expected / unexpected / out-of-scope against that intent. Returns an `intent` echo and an `intentAnalysis` summary; per-finding labels appear as `intentAlignment` on each changedFile / riskyFunction / newCycle / newTaintFlow / dependencyChange. Does NOT change the verdict (verdict stays structural).',
      },
    },
  },
  handler: async (args, rootPath) => {
    emitProgress(0, 4, 'resolving refs');
    const base = typeof args.base === 'string' ? args.base : undefined;
    const head = typeof args.head === 'string' ? args.head : undefined;
    const intent = typeof args.intent === 'string' ? args.intent : undefined;
    emitProgress(1, 4, 'building base + head graphs');
    const packageName =
      typeof args.package === 'string' && args.package.length > 0 ? args.package : undefined;
    if (packageName) emitProgress(2, 4, 'scoping to workspace');
    const report = await computeReview(rootPath, { base, head, intent, package: packageName });

    emitProgress(4, 4, 'done');

    // 1.5 — adaptive shape based on max_cost_tokens. With no budget,
    // returns the full report unchanged. With a budget, picks a tier
    // and reshapes — the response carries `tier` so the agent can
    // detect what they got and re-call at a higher budget if needed.
    const maxCostTokens =
      typeof args.max_cost_tokens === 'number' && Number.isFinite(args.max_cost_tokens)
        ? args.max_cost_tokens
        : undefined;
    const tier = selectReviewTier(maxCostTokens);
    if (tier === 'full' && maxCostTokens === undefined) {
      // Preserve existing 1.4-and-earlier shape (no `tier` field) when
      // no budget was given. Adding the field unconditionally would be
      // additive but slightly noisy on every call.
      return report;
    }
    return shapeReviewForTier(report, tier);
  },
};
