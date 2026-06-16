import { computeMergeRisk } from '../../core/mergeRisk.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_merge_risk` (4.x coordination arc, epic 3) — given the repo's
 * in-flight worktrees and their collisions, return a safe integration order and
 * the files where conflict risk concentrates. Builds on `projscan_collision`.
 */
export const mergeRiskTool: McpTool = {
  name: 'projscan_merge_risk',
  description:
    "Merge-risk preflight across the repo's in-flight git worktrees (parallel agents). Given each worktree's changes and the collisions between them, returns `integrationOrder` (merge the least-entangled branch first, each with a risk score) and `hotFiles` (files changed by two or more worktrees — where merge conflict risk concentrates). Builds on projscan_collision; local-first; needs at least two worktrees.",
  inputSchema: {
    type: 'object',
    properties: {
      base_ref: {
        type: 'string',
        description:
          'Base ref each worktree is diffed against. Default: origin/main → main → master → HEAD~1.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const baseRef =
      typeof args.base_ref === 'string' && args.base_ref.length > 0 ? args.base_ref : undefined;
    return computeMergeRisk(rootPath, baseRef ? { baseRef } : {});
  },
};
