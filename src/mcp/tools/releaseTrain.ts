import { computeReleaseTrain } from '../../core/releaseTrain.js';
import type { McpTool } from './_shared.js';

export const releaseTrainTool: McpTool = {
  name: 'projscan_release_train',
  description:
    'Plan upcoming product lines with version, scope, readiness, and next-action evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: { type: 'string' },
        description: 'Product lines to include. Default: next six minor lines.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    releaseTrain: await computeReleaseTrain(rootPath, {
      lines: Array.isArray(args.lines)
        ? args.lines.filter((line): line is string => typeof line === 'string')
        : undefined,
    }),
  }),
};
