import { computeAssess } from '../../core/assess.js';
import type { AssessMode } from '../../types/assess.js';
import type { McpTool } from './_shared.js';

const ASSESS_MODES = new Set<AssessMode>(['standard', 'fix-first', 'ship-readiness']);

export const assessTool: McpTool = {
  name: 'projscan_assess',
  description:
    'Run a proof-first engineering assessment. Returns Proof Cards with local evidence, fix-first guidance, risk delta, verification commands, and ship-readiness wording.',
  inputSchema: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'Plain-language assessment goal. Example: "make this repo safer to ship".',
      },
      mode: {
        type: 'string',
        description:
          'Assessment mode: standard, fix-first, or ship-readiness. fix-first returns the shortest action queue.',
      },
      max_cards: {
        type: 'number',
        description: 'Maximum Proof Cards to return. Default: 5, max: 25.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    assess: await computeAssess(rootPath, {
      goal: typeof args.goal === 'string' ? args.goal : undefined,
      mode: parseMode(args.mode),
      maxCards:
        typeof args.max_cards === 'number' && Number.isFinite(args.max_cards)
          ? args.max_cards
          : undefined,
    }),
  }),
};

function parseMode(value: unknown): AssessMode | undefined {
  return typeof value === 'string' && ASSESS_MODES.has(value as AssessMode)
    ? (value as AssessMode)
    : undefined;
}

