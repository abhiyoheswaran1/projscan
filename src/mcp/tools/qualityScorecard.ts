import { computeQualityScorecard } from '../../core/qualityScorecard.js';
import type { McpTool } from './_shared.js';

export const qualityScorecardTool: McpTool = {
  name: 'projscan_quality_scorecard',
  description:
    'Summarize quality dimensions, top risks, verification commands, and suggested next actions for agents and reviewers.',
  inputSchema: {
    type: 'object',
    properties: {
      max_risks: {
        type: 'number',
        description: 'Maximum top risks to return. Default: 8, max: 25.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    qualityScorecard: await computeQualityScorecard(rootPath, {
      maxRisks:
        typeof args.max_risks === 'number' && Number.isFinite(args.max_risks)
          ? args.max_risks
          : undefined,
    }),
  }),
};
