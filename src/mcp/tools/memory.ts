import type { McpTool } from './_shared.js';
import {
  findAcceptedHotspots,
  findStableRules,
  forgetHotspot,
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
        enum: ['current', 'stable', 'runs', 'accepted', 'forget', 'forget-hotspot'],
        description:
          'Subaction. "current" returns aggregate counts. "stable" returns long-running rules with a config-snippet suggestion. "runs" returns every tracked rule. "accepted" (1.5+) returns files Project Memory marks as accepted load-bearing debt (top-K hotspot for ≥ 5 runs over ≥ 7 days without improving). "forget" drops one rule. "forget-hotspot" drops one file from hotspot memory.',
      },
      rule: {
        type: 'string',
        description: '"forget" only — the rule id to drop from memory.',
      },
      file: {
        type: 'string',
        description: '"forget-hotspot" only — the repo-relative path to drop from hotspot memory.',
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
      case 'accepted':
        return acceptedView(memory);
      case 'forget': {
        const rule = typeof args.rule === 'string' ? args.rule : '';
        if (!rule) throw new Error('forget action requires a "rule" argument');
        const existed = forgetRule(memory, rule);
        if (existed) await saveMemory(rootPath, memory);
        return { action: 'forget', rule, dropped: existed };
      }
      case 'forget-hotspot': {
        const file = typeof args.file === 'string' ? args.file : '';
        if (!file) throw new Error('forget-hotspot action requires a "file" argument');
        const existed = forgetHotspot(memory, file);
        if (existed) await saveMemory(rootPath, memory);
        return { action: 'forget-hotspot', file, dropped: existed };
      }
      default:
        throw new Error(
          `Unknown action "${action}". Valid actions: current, stable, runs, accepted, forget, forget-hotspot.`,
        );
    }
  },
};

function summarize(memory: ProjectMemory): Record<string, unknown> {
  const stableCount = findStableRules(memory).length;
  const acceptedCount = findAcceptedHotspots(memory).length;
  return {
    schemaVersion: memory.schemaVersion,
    totalRuns: memory.totalRuns,
    rulesTracked: Object.keys(memory.rules).length,
    hotspotsTracked: Object.keys(memory.hotspots ?? {}).length,
    stableRuleCount: stableCount,
    acceptedHotspotCount: acceptedCount,
    lastUpdatedAt: memory.lastUpdatedAt,
  };
}

function acceptedView(memory: ProjectMemory): Record<string, unknown> {
  const accepted = findAcceptedHotspots(memory);
  return {
    totalRuns: memory.totalRuns,
    acceptedCount: accepted.length,
    accepted: accepted.map((o) => ({
      file: o.file,
      runCount: o.runCount,
      firstSeenAt: o.firstSeenAt,
      lastSeenAt: o.lastSeenAt,
      lastCc: o.lastCc,
      lastChurn: o.lastChurn,
    })),
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
