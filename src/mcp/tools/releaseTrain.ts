import { computeReleaseTrain } from '../../core/releaseTrain.js';
import type { McpTool } from './_shared.js';

export const releaseTrainTool: McpTool = {
  name: 'projscan_release_train',
  description:
    'Plan multiple release lines as one unreleased roll-up. Reads version and readiness signals but never bumps versions, creates tags, or publishes.',
  inputSchema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        items: { type: 'string' },
        description: 'Release lines to fold into the current unreleased train. Default: next two minor lines.',
      },
      rollup: {
        type: 'string',
        enum: ['unreleased'],
        description: 'Roll-up target. Currently only "unreleased" is supported and performs no release mutation.',
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
      rollup: 'unreleased',
    }),
  }),
};
