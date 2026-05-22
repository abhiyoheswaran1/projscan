import { computeBugHunt } from '../../core/bugHunt.js';
import type { McpTool } from './_shared.js';

export const bugHuntTool: McpTool = {
  name: 'projscan_bug_hunt',
  description:
    'Run an agent-ready bug hunt. Combines doctor issues, preflight verdict, hotspots, and session coordination into a prioritized fix queue with verification commands.',
  inputSchema: {
    type: 'object',
    properties: {
      max_findings: {
        type: 'number',
        description: 'Maximum number of fix-queue findings to return. Default: 10, max: 25.',
      },
      since: {
        type: 'string',
        description: 'Git history window for hotspot evidence. Examples: "6 months ago", "2024-01-01".',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    bugHunt: await computeBugHunt(rootPath, {
      maxFindings:
        typeof args.max_findings === 'number' && Number.isFinite(args.max_findings)
          ? args.max_findings
          : undefined,
      since: typeof args.since === 'string' ? args.since : undefined,
    }),
  }),
};
