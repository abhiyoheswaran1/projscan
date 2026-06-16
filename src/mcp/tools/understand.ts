import { computeUnderstandReport } from '../../core/understand.js';
import type { UnderstandView } from '../../types/understand.js';
import type { McpTool } from './_shared.js';

const VIEWS: readonly UnderstandView[] = ['map', 'flow', 'contracts', 'change', 'verify'];

export const understandTool: McpTool = {
  name: 'projscan_understand',
  description:
    'Explain repo map, runtime flows, public contracts, change readiness, and verification proof with cited file/symbol evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      view: {
        type: 'string',
        enum: VIEWS,
        description: 'Understand view. Default: map.',
      },
      intent: {
        type: 'string',
        description: 'Planned change or question for change-readiness output.',
      },
      max_items: {
        type: 'number',
        description: 'Maximum items per section. Default: 8, max: 30.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    understand: await computeUnderstandReport(rootPath, {
      view: readView(args.view),
      intent: typeof args.intent === 'string' ? args.intent : undefined,
      maxItems:
        typeof args.max_items === 'number' && Number.isFinite(args.max_items)
          ? args.max_items
          : undefined,
    }),
  }),
};

function readView(value: unknown): UnderstandView | undefined {
  if (typeof value === 'string' && (VIEWS as readonly string[]).includes(value))
    return value as UnderstandView;
  return undefined;
}
