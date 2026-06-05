import { computeCoordination } from '../../core/coordination.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_coordinate` (4.x arc, epic 5 — capstone) — one-call coordination
 * read across the repo's in-flight worktrees, composing collisions, claims, and
 * merge-risk into a single readiness verdict + counts. Local-first.
 */
export const coordinateTool: McpTool = {
  name: 'projscan_coordinate',
  description:
    "One-call coordination read across the repo's in-flight git worktrees (parallel agents). Composes collisions, claims, and merge-risk into a `readiness` verdict (clear | caution | conflicted) plus counts (collisions by severity, contended claim targets, merge hotspots) and the recommended integration order. The single entry point for swarm coordination — use it before continuing parallel work. Local-first; needs at least two worktrees.",
  inputSchema: {
    type: 'object',
    properties: {
      base_ref: {
        type: 'string',
        description: 'Base ref each worktree is diffed against. Default: origin/main → main → master → HEAD~1.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const baseRef = typeof args.base_ref === 'string' && args.base_ref.length > 0 ? args.base_ref : undefined;
    return computeCoordination(rootPath, baseRef ? { baseRef } : {});
  },
};
