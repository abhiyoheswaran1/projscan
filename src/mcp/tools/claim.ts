import { addClaim, listClaims, releaseClaim, pruneClaims } from '../../core/claims.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_claim` (4.x coordination arc) — advisory claims / leases so parallel
 * agents see who owns which file, directory, or symbol. Shared across the
 * repo's git worktrees; local-first.
 */
export const claimTool: McpTool = {
  name: 'projscan_claim',
  description:
    "Coordinate parallel agents with advisory claims/leases over files, directories, or symbols, shared across the repo's git worktrees. action:\"add\" records a claim (optionally a lease with `ttl_seconds`) and returns any `contention` (another agent already holding an overlapping, non-expired claim); \"list\" returns claims; \"release\" drops a claim by `id`, by `target`, or all of an `agent`'s; \"prune\" removes expired-lease claims. Local-first and advisory — claiming an already-claimed target still succeeds, but surfaces contention so the swarm can coordinate.",
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'list', 'release', 'prune'],
        description: 'Default "list". "add" records a claim; "release" drops one; "prune" removes expired leases.',
      },
      target: {
        type: 'string',
        description: '"add"/"release" — a repo-relative file or directory path, or a symbol name.',
      },
      agent: {
        type: 'string',
        description: '"add" — who holds the claim. "release" — scope the release to this agent.',
      },
      note: { type: 'string', description: '"add" — optional human-readable note.' },
      ttl_seconds: { type: 'number', description: '"add" — lease duration in seconds; the claim expires after it. Omit for a permanent claim.' },
      id: { type: 'string', description: '"release" — the claim id to drop.' },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'list';
    switch (action) {
      case 'add': {
        const target = typeof args.target === 'string' ? args.target : '';
        const agent = typeof args.agent === 'string' ? args.agent : '';
        if (!target || !agent) {
          throw new Error('projscan_claim add requires both `target` and `agent`.');
        }
        const note = typeof args.note === 'string' && args.note.length > 0 ? args.note : undefined;
        const ttlSeconds =
          typeof args.ttl_seconds === 'number' && args.ttl_seconds > 0 ? args.ttl_seconds : undefined;
        return addClaim(rootPath, {
          target,
          agent,
          ...(note ? { note } : {}),
          ...(ttlSeconds !== undefined ? { ttlSeconds } : {}),
        });
      }
      case 'release': {
        const selector = {
          id: typeof args.id === 'string' && args.id.length > 0 ? args.id : undefined,
          target: typeof args.target === 'string' && args.target.length > 0 ? args.target : undefined,
          agent: typeof args.agent === 'string' && args.agent.length > 0 ? args.agent : undefined,
        };
        if (!selector.id && !selector.target && !selector.agent) {
          throw new Error('projscan_claim release requires one of `id`, `target`, or `agent`.');
        }
        return { released: await releaseClaim(rootPath, selector) };
      }
      case 'prune':
        return { pruned: await pruneClaims(rootPath) };
      case 'list':
        return { claims: await listClaims(rootPath) };
      default:
        throw new Error(`Unknown action "${action}". Known: add, list, release, prune.`);
    }
  },
};
