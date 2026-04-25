import { detectOutdated } from '../../core/outdatedDetector.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { PACKAGE_ARG_SCHEMA, type McpTool } from './_shared.js';

export const outdatedTool: McpTool = {
  name: 'projscan_outdated',
  description:
    'Compare declared vs installed versions of every package. Reports drift (patch/minor/major). Workspace-aware in monorepos: each package.json is scanned, and each entry is tagged with the workspace it came from. Pass `package` to scope to a single workspace. Offline - does not hit the npm registry. Supports cursor pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      package: PACKAGE_ARG_SCHEMA,
      cursor: { type: 'string', description: 'Opaque cursor from a previous response.' },
      page_size: { type: 'number', description: 'Items per page (default 50).' },
      max_tokens: { type: 'number', description: 'Cap response size.' },
    },
  },
  handler: async (args, rootPath) => {
    const workspaces = await detectWorkspaces(rootPath);
    const report = await detectOutdated(rootPath, {
      workspaces,
      ...(typeof args.package === 'string' ? { workspaceFilter: args.package } : {}),
    });
    if (!report.available) return report;
    const page = paginate(report.packages, readPageParams(args), listChecksum(report.packages));
    return {
      available: true,
      totalPackages: report.totalPackages,
      packages: page.items,
      byWorkspace: report.byWorkspace,
      total: page.total,
      nextCursor: page.nextCursor,
    };
  },
};
