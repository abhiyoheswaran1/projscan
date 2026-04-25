import ora from 'ora';
import chalk from 'chalk';
import path from 'node:path';

import {
  program,
  getFormat,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
  sliceCliTree,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { detectWorkspaces } from '../../core/monorepo.js';
import { reportStructure } from '../../reporters/consoleReporter.js';
import { reportStructureJson } from '../../reporters/jsonReporter.js';
import { reportStructureMarkdown } from '../../reporters/markdownReporter.js';

export function registerStructure(): void {
  program
    .command('structure')
    .description('Show project directory structure')
    .option('--package <name>', 'monorepo: scope tree to a single workspace package')
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora('Scanning...').start() : null;

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        let tree = scan.directoryTree;
        let title = path.basename(rootPath);
        if (cmdOpts.package) {
          const ws = await detectWorkspaces(rootPath);
          const pkg = ws.packages.find((p) => p.name === cmdOpts.package);
          if (pkg && !pkg.isRoot && pkg.relativePath) {
            const sliced = sliceCliTree(tree, pkg.relativePath);
            if (sliced) {
              tree = sliced;
              title = pkg.name;
            }
          }
        }

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportStructureJson(tree);
            break;
          case 'markdown':
            reportStructureMarkdown(tree);
            break;
          default:
            reportStructure(tree, title);
        }
      } catch (error) {
        if (spinner) spinner.fail('Structure scan failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
