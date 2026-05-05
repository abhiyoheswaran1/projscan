import { scanRepository } from '../../core/repositoryScanner.js';
import { previewUpgrade } from '../../core/upgradePreview.js';
import { isPythonDominated, type McpTool } from './_shared.js';

export const upgradeTool: McpTool = {
  name: 'projscan_upgrade',
  description:
    'Preview the impact of upgrading a package: semver drift, breaking-change markers from the local CHANGELOG, and the files in your repo that import it. Offline by default; pass `check_registry: true` (1.3+) to fetch the actual latest version from npm.',
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
        'package argument is required: pass an npm package name (e.g. "chalk" or "@types/node"). List candidates with projscan_outdated or projscan_dependencies.',
      );
    }
    const checkRegistry = args.check_registry === true;
    const scan = await scanRepository(rootPath);

    if (await isPythonDominated(rootPath, scan.files)) {
      return {
        available: false,
        reason:
          'Upgrade preview is currently supported only for Node.js packages. Python support is planned for a future release.',
        name: pkgName,
        declared: null,
        installed: null,
        latest: null,
        drift: 'unknown',
        breakingMarkers: [],
        importers: [],
      };
    }

    return await previewUpgrade(rootPath, pkgName, scan.files, { checkRegistry });
  },
};
