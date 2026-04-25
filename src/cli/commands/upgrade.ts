import ora from 'ora';
import chalk from 'chalk';

import {
  program,
  getFormat,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { previewUpgrade } from '../../core/upgradePreview.js';
import { reportUpgrade } from '../../reporters/consoleReporter.js';
import { reportUpgradeJson } from '../../reporters/jsonReporter.js';
import { reportUpgradeMarkdown } from '../../reporters/markdownReporter.js';

export function registerUpgrade(): void {
  program
    .command('upgrade <package>')
    .description('Preview the impact of upgrading a package (offline - reads local CHANGELOG + importers)')
    .action(async (pkgName: string) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const config = await loadProjectConfig();
      const spinner = format === 'console' ? ora(`Previewing ${pkgName}...`).start() : null;

      try {
        const scan = await scanRepository(rootPath, { ignore: config.ignore });
        const preview = await previewUpgrade(rootPath, pkgName, scan.files);
        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportUpgradeJson(preview);
            break;
          case 'markdown':
            reportUpgradeMarkdown(preview);
            break;
          default:
            reportUpgrade(preview);
        }
      } catch (error) {
        if (spinner) spinner.fail('Upgrade preview failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
