import { computeStartReport } from '../../core/start.js';
import { isWorkplanMode } from '../../core/workplan.js';
import type { WorkplanMode } from '../../types.js';
import type { McpTool } from './_shared.js';

const START_MODES: readonly WorkplanMode[] = [
  'before_edit',
  'before_commit',
  'before_merge',
  'refactor',
  'release',
  'bug_hunt',
  'hardening',
];

export const startTool: McpTool = {
  name: 'projscan_start',
  description:
    'First-60-seconds repo orientation for agents and developers. Composes setup diagnostics, workplan, quality scorecard, adoption gaps, top risks, and next commands into one read-only workflow recommendation.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: START_MODES,
        description: 'Workflow mode to orient around. Default: before_edit.',
      },
      intent: {
        type: 'string',
        description: 'Plain-language goal to route into the next best action and proof commands.',
      },
      max_tasks: {
        type: 'number',
        description: 'Maximum workplan tasks to inspect. Default: 5, max: 12.',
      },
      max_risks: {
        type: 'number',
        description: 'Maximum top risks to return. Default: 5, max: 12.',
      },
      include_handoff: {
        type: 'boolean',
        description: 'Include a compact handoff payload for the next agent.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    start: await computeStartReport(rootPath, {
      mode: readMode(args.mode),
      intent: typeof args.intent === 'string' ? args.intent : undefined,
      maxTasks: readNumber(args.max_tasks),
      maxRisks: readNumber(args.max_risks),
      includeHandoff: args.include_handoff === true,
    }),
  }),
};

function readMode(value: unknown): WorkplanMode | undefined {
  if (typeof value === 'string' && isWorkplanMode(value)) return value;
  return undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
