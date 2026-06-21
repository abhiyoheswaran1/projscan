import { computeSimulation } from '../../core/simulate.js';
import type { McpTool } from './_shared.js';

export const simulateTool: McpTool = {
  name: 'projscan_simulate',
  description:
    'Simulate a proposed change plan before editing. Returns likely files, tests, contracts, rollout, proof commands, and projected risk delta from local evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      plan: {
        type: 'string',
        description:
          'Plain-language change plan. Example: "split bugHunt.ts into ranking, evidence, and output modules".',
      },
      max_files: {
        type: 'number',
        description: 'Maximum likely touched files to return. Default: 5, max: 25.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
    required: ['plan'],
  },
  handler: async (args, rootPath) => ({
    simulate: await computeSimulation(rootPath, {
      plan: typeof args.plan === 'string' ? args.plan : '',
      maxFiles:
        typeof args.max_files === 'number' && Number.isFinite(args.max_files)
          ? args.max_files
          : undefined,
    }),
  }),
};

