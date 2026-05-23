import {
  computeFirstRunDiagnostics,
  getMcpConfigGuide,
  getWorkflowRecipes,
  isMcpClientId,
} from '../../core/adoption.js';
import type { McpTool } from './_shared.js';

export const adoptionTool: McpTool = {
  name: 'projscan_adoption',
  description:
    'Adoption helper for new projscan users and agents. Returns ready-to-paste MCP client configs, workflow recipes, or first-run diagnostics without mutating the repo.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['mcp_config', 'recipes', 'first_run'],
        description:
          'What to return. mcp_config returns client snippets, recipes returns agent workflow recipes, first_run checks setup diagnostics. Default: recipes.',
      },
      client: {
        type: 'string',
        description:
          'For action=mcp_config: all, claude-desktop, claude-code, cursor, codex, continue, windsurf, cline, zed, or gemini. Default: all.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'recipes';
    if (action === 'mcp_config') {
      const client = isMcpClientId(args.client) ? args.client : 'all';
      return { config: getMcpConfigGuide(client) };
    }
    if (action === 'first_run') {
      return { firstRun: await computeFirstRunDiagnostics(rootPath) };
    }
    return { recipes: getWorkflowRecipes() };
  },
};
