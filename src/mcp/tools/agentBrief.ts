import { computeAgentBrief } from '../../core/agentBrief.js';
import type { AgentBriefIntent } from '../../types.js';
import type { McpTool } from './_shared.js';

const INTENTS: readonly AgentBriefIntent[] = [
  'next_agent',
  'bug_hunt',
  'release',
  'refactor',
  'hardening',
];

export const agentBriefTool: McpTool = {
  name: 'projscan_agent_brief',
  description:
    'Create a compact next-agent context packet with prioritized focus items, repo context, guardrails, and suggested next actions.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: INTENTS,
        description: 'Brief intent. Default: next_agent.',
      },
      max_items: {
        type: 'number',
        description: 'Maximum focus items to return. Default: 6, max: 20.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    agentBrief: await computeAgentBrief(rootPath, {
      intent: readIntent(args.intent),
      maxItems:
        typeof args.max_items === 'number' && Number.isFinite(args.max_items)
          ? args.max_items
          : undefined,
    }),
  }),
};

function readIntent(value: unknown): AgentBriefIntent | undefined {
  if (typeof value === 'string' && (INTENTS as readonly string[]).includes(value)) {
    return value as AgentBriefIntent;
  }
  return undefined;
}
