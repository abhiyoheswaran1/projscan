import { routeIntent } from '../../core/intentRouter.js';
import type { McpTool } from './_shared.js';

/**
 * `projscan_route` (4.x agent-ergonomics, epic 4) — map a stated goal to the
 * right projscan tool, so an agent can find the one tool it needs without
 * reasoning over the whole surface. Deterministic (no LLM).
 */
export const routeTool: McpTool = {
  name: 'projscan_route',
  description:
    "Find the right projscan tool for a goal. Given `intent` (free text — e.g. \"what breaks if I rename X\", \"coordinate parallel agents\", \"is it safe to commit\"), returns the best-matching tool(s) with the exact call and why to use each. With no `intent`, returns the full capability catalog grouped by category. A discovery entry point over projscan's surface; deterministic keyword routing, no inference.",
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'What you want to do, in plain words. Omit to get the full grouped tool catalog.',
      },
    },
  },
  handler: async (args) => {
    const intent = typeof args.intent === 'string' && args.intent.length > 0 ? args.intent : undefined;
    return routeIntent(intent);
  },
};
