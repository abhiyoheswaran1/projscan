import { computeRegressionPlan } from '../../core/regressionPlan.js';
import type { RegressionPlanLevel } from '../../types.js';
import type { McpTool } from './_shared.js';

const LEVELS: readonly RegressionPlanLevel[] = ['smoke', 'focused', 'full'];

export const regressionPlanTool: McpTool = {
  name: 'projscan_regression_plan',
  description:
    'Build a smoke, focused, or full regression matrix from bug-hunt, preflight, and product risk signals.',
  inputSchema: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: LEVELS,
        description: 'Regression depth. Default: focused.',
      },
      lines: {
        type: 'array',
        items: { type: 'string' },
        description: 'Product lines to include. Default: next six minor lines.',
      },
      max_targets: {
        type: 'number',
        description: 'Maximum regression targets to include. Default: 8, max: 25.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => ({
    regressionPlan: await computeRegressionPlan(rootPath, {
      level: readLevel(args.level),
      lines: Array.isArray(args.lines)
        ? args.lines.filter((line): line is string => typeof line === 'string')
        : undefined,
      maxTargets:
        typeof args.max_targets === 'number' && Number.isFinite(args.max_targets)
          ? args.max_targets
          : undefined,
    }),
  }),
};

function readLevel(value: unknown): RegressionPlanLevel | undefined {
  if (typeof value === 'string' && (LEVELS as readonly string[]).includes(value)) {
    return value as RegressionPlanLevel;
  }
  return undefined;
}
