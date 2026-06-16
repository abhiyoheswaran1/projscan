import { detectCollisions } from '../../core/collisionDetector.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_collision` (4.x coordination arc) — detect change collisions across
 * the repo's in-flight git worktrees, so parallel agents see overlaps before
 * their branches merge. Local-first; reads `git worktree list` only.
 */
export const collisionTool: McpTool = {
  name: 'projscan_collision',
  description:
    "Detect change collisions across the repo's in-flight git worktrees (parallel agents). Reports same-file edits (two worktrees changed the same file) and dependency overlaps (one worktree changed a file another's change imports, via the import graph) BEFORE the branches merge. Local-first; needs at least two worktrees. Each collision has `kind` (same-file | dependency), `severity` (high | medium), the two worktree paths, and the files at risk. Use this when coordinating multiple agents/sub-agents working the same repo.",
  inputSchema: {
    type: 'object',
    properties: {
      base_ref: {
        type: 'string',
        description:
          'Base ref each worktree is diffed against to compute its changed files. Default: origin/main → main → master → HEAD~1, then the working tree.',
      },
      transitive: {
        type: 'boolean',
        description:
          'Also report multi-hop dependency overlaps (one worktree changed a file another transitively imports), each with a `distance`. Default false — the 1-hop default stays precise; this trades precision for deeper recall.',
      },
      max_distance: {
        type: 'number',
        description: 'Max import hops when `transitive` is set. Default 5.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const baseRef =
      typeof args.base_ref === 'string' && args.base_ref.length > 0 ? args.base_ref : undefined;
    const transitive = args.transitive === true;
    const maxDistance =
      typeof args.max_distance === 'number' && args.max_distance > 0
        ? args.max_distance
        : undefined;
    return detectCollisions(rootPath, {
      ...(baseRef ? { baseRef } : {}),
      ...(transitive ? { transitive: true } : {}),
      ...(maxDistance !== undefined ? { maxDistance } : {}),
    });
  },
};
