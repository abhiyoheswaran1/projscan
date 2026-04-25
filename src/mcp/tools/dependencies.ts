import { analyzeDependencies } from '../../core/dependencyAnalyzer.js';
import type { McpTool } from './_shared.js';

export const dependenciesTool: McpTool = {
  name: 'projscan_dependencies',
  description: 'Analyze package.json dependencies and return counts and risks (deprecated packages, wildcard versions, etc.).',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, rootPath) => {
    const report = await analyzeDependencies(rootPath);
    if (!report) return { available: false, reason: 'No package.json found' };
    return { available: true, ...report };
  },
};
