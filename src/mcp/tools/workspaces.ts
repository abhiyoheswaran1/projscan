import { detectWorkspaces } from '../../core/monorepo.js';
import type { McpTool } from './_shared.js';

export const workspacesTool: McpTool = {
  name: 'projscan_workspaces',
  description:
    'List monorepo workspace packages (npm/yarn workspaces, pnpm-workspace.yaml, Nx/Turbo/Lerna fallback). Returns one row per package with name, relative path, and version. Use the package `name` as the `package` argument on projscan_hotspots / projscan_coupling to scope those tools to a single package.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, rootPath) => {
    return await detectWorkspaces(rootPath);
  },
};
