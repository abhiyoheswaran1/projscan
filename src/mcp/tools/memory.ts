import type { McpTool } from './_shared.js';
import {
  findStableRules,
  forgetRule,
  loadMemory,
  saveMemory,
  type ProjectMemory,
} from '../../core/memory.js';

/**
 * `projscan_memory` (1.5+) — surface the local Project Memory store
 * so an agent (or the user via the CLI) can see which issues this
 * project has been carrying across many runs and act on them.
 *
 * Subactions:
 *   - "current" (default): aggregate counts (total runs, rules tracked,
 *     stable-rule count, last update timestamp).
 *   - "stable": rules that have surfaced across enough runs over enough
 *     time to count as "user has accepted" — paired with a ready-to-paste
 *     `.projscanrc.disableRules` snippet.
 *   - "runs": every tracked rule with its observation history. Useful
 *     for debugging the memory's view of the project.
 *   - "forget": drop a single rule's history (requires `rule` arg).
 *
 * Read-only except `forget`.
 */
export const memoryTool: McpTool = {
  name: 'projscan_memory',
  description:
    'Inspect or prune the local Project Memory: which analyzer rules have been surfacing repeatedly without being addressed, and what to do about them. Use when an agent wants to know "what is this project tolerating and could quiet down via .projscanrc?"',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['current', 'stable', 'runs', 'forget'],
        description:
          'Subaction. Default "current" returns aggregate counts. "stable" returns the long-running rules with a config-snippet suggestion. "runs" returns every tracked rule. "forget" drops one rule\'s history.',
      },
      rule: {
        type: 'string',
        description: '"forget" only — the rule id to drop from memory.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'current';
    const memory = await loadMemory(rootPath);

    switch (action) {
      case 'current':
        return summarize(memory);
      case 'stable':
        return stableView(memory);
      case 'runs':
        return runsView(memory);
      case 'forget': {
        const rule = typeof args.rule === 'string' ? args.rule : '';
        if (!rule) throw new Error('forget action requires a "rule" argument');
        const existed = forgetRule(memory, rule);
        if (existed) await saveMemory(rootPath, memory);
        return { action: 'forget', rule, dropped: existed };
      }
      default:
        throw new Error(
          `Unknown action "${action}". Valid actions: current, stable, runs, forget.`,
        );
    }
  },
};

function summarize(memory: ProjectMemory): Record<string, unknown> {
  const stableCount = findStableRules(memory).length;
  return {
    schemaVersion: memory.schemaVersion,
    totalRuns: memory.totalRuns,
    rulesTracked: Object.keys(memory.rules).length,
    stableRuleCount: stableCount,
    lastUpdatedAt: memory.lastUpdatedAt,
  };
}

function stableView(memory: ProjectMemory): Record<string, unknown> {
  const stable = findStableRules(memory);
  // A ready-to-paste config snippet so the user can disable everything
  // they've effectively accepted in one move.
  const disableRulesSnippet =
    stable.length > 0
      ? {
          disableRules: stable.map((r) => r.ruleId),
        }
      : undefined;
  return {
    totalRuns: memory.totalRuns,
    stableCount: stable.length,
    stable: stable.map((r) => ({
      ruleId: r.ruleId,
      runCount: r.runCount,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    })),
    ...(disableRulesSnippet
      ? { configSuggestion: { '.projscanrc.json': disableRulesSnippet } }
      : {}),
  };
}

function runsView(memory: ProjectMemory): Record<string, unknown> {
  const all = Object.values(memory.rules).sort((a, b) => b.runCount - a.runCount);
  return {
    totalRuns: memory.totalRuns,
    rulesTracked: all.length,
    rules: all,
  };
}
