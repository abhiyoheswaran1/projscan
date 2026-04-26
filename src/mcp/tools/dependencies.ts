import { analyzeDependencies } from '../../core/dependencyAnalyzer.js';
import type { McpTool } from './_shared.js';

export const dependenciesTool: McpTool = {
  name: 'projscan_dependencies',
  description:
    'Analyze package.json dependencies and return counts and risks (deprecated packages, wildcard versions, etc.). In a monorepo, returns aggregated totals plus a `byWorkspace` breakdown; pass `package` to scope to one workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      package: {
        type: 'string',
        description: 'Optional. Workspace package name to scope analysis to one workspace only.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const filter = typeof args.package === 'string' && args.package.length > 0 ? args.package : undefined;
    const report = await analyzeDependencies(rootPath, { packageFilter: filter });
    if (!report) return { available: false, reason: filter ? `Workspace not found: ${filter}` : 'No package.json found' };
    return { available: true, ...report };
  },
};
