import { scanRepository } from '../../core/repositoryScanner.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import { PACKAGE_ARG_SCHEMA, sliceTree, type McpTool } from './_shared.js';

export const structureTool: McpTool = {
  name: 'projscan_structure',
  description: 'Return the project directory tree with file counts.',
  inputSchema: {
    type: 'object',
    properties: {
      package: PACKAGE_ARG_SCHEMA,
    },
  },
  handler: async (args, rootPath) => {
    const scan = await scanRepository(rootPath);
    const pkgName = typeof args.package === 'string' && args.package.length > 0 ? args.package : null;
    if (!pkgName) {
      return { structure: scan.directoryTree, totalFiles: scan.totalFiles };
    }
    const ws = await detectWorkspaces(rootPath);
    const pkg = ws.packages.find((p) => p.name === pkgName);
    if (!pkg || pkg.isRoot || !pkg.relativePath) {
      return { structure: scan.directoryTree, totalFiles: scan.totalFiles };
    }
    const sliced = sliceTree(scan.directoryTree, pkg.relativePath);
    if (!sliced) {
      return {
        structure: { name: pkg.name, path: pkg.relativePath, children: [], fileCount: 0, totalFileCount: 0 },
        totalFiles: 0,
      };
    }
    return { structure: sliced, totalFiles: sliced.totalFileCount };
  },
};
