import { scanRepository } from '../../core/repositoryScanner.js';
import { previewUpgrade } from '../../core/upgradePreview.js';
import type { McpTool } from './_shared.js';

export const upgradeTool: McpTool = {
  name: 'projscan_upgrade',
  description:
    'Preview the impact of upgrading a package: npm semver drift, breaking-change markers from a local CHANGELOG, Python manifest/lockfile declarations, and files in your repo that import it. Offline by default; pass `check_registry: true` (1.3+) to fetch the actual latest npm version.',
  inputSchema: {
    type: 'object',
    properties: {
      package: {
        type: 'string',
        description: 'Name of the package to preview.',
      },
      check_registry: {
        type: 'boolean',
        description:
          '1.3+ — when true, fetch the latest version from registry.npmjs.org (network-required). Default false: latest is treated as the installed version.',
      },
    },
    required: ['package'],
  },
  handler: async (args, rootPath) => {
    const pkgName = typeof args.package === 'string' ? args.package : '';
    if (!pkgName) {
      throw new Error(
        'package argument is required: pass a package name (e.g. "chalk", "@types/node", or "requests"). List candidates with projscan_outdated or projscan_dependencies.',
      );
    }
    const checkRegistry = args.check_registry === true;
    const scan = await scanRepository(rootPath);

    return await previewUpgrade(rootPath, pkgName, scan.files, { checkRegistry });
  },
};
