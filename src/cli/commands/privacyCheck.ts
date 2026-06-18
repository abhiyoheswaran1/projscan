import chalk from 'chalk';

import {
  program,
  getRootPath,
  loadProjectConfig,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
} from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import {
  buildPrivacyCheckReport,
  enableOfflineMode,
  type PrivacyCheckReport,
} from '../../core/privacy.js';

export function registerPrivacyCheck(): void {
  program
    .command('privacy-check')
    .description('Show the local privacy, ignore, telemetry, and network boundary')
    .option('--offline', 'block network-capable features for this privacy-check run')
    .action(async (options: { offline?: boolean }) => {
      setupLogLevel();
      if (options.offline) enableOfflineMode();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = assertFormatSupported('privacy-check');
      const config = await loadProjectConfig();

      try {
        const scan = await scanRepository(rootPath, {
          ignore: config.ignore,
          includeIgnored: config.scan?.includeIgnored,
        });
        const report = await buildPrivacyCheckReport(rootPath, scan, config);

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }

        reportPrivacyCheck(report);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function reportPrivacyCheck(report: PrivacyCheckReport): void {
  console.log(chalk.bold('projscan privacy-check'));
  console.log();
  console.log(`${chalk.bold('Telemetry')}: ${report.telemetry.enabled ? 'enabled' : 'disabled'}`);
  console.log(
    `${chalk.bold('Offline mode')}: ${report.offline.enabled ? 'enabled' : 'disabled'} (${report.offline.env})`,
  );
  console.log(`${chalk.bold('Scan root')}: ${report.scan.rootPath}`);
  console.log(
    `${chalk.bold('.gitignore respected')}: ${report.scan.gitignoreRespected ? 'yes' : 'no'}`,
  );
  console.log(`${chalk.bold('File source')}: ${report.scan.source}`);
  console.log(`${chalk.bold('Include ignored')}: ${report.scan.includeIgnored ? 'yes' : 'no'}`);
  console.log(`${chalk.bold('Ignored files hidden')}: ${report.scan.ignoredFileCount}`);
  console.log(
    `${chalk.bold('.env content scanning')}: ${report.envContentScanning ? 'enabled' : 'disabled'}`,
  );
  console.log(
    `${chalk.bold('Plugin execution')}: ${report.plugins.executionEnabled ? 'enabled' : 'disabled'} (${report.plugins.envFlag}=1)`,
  );
  console.log(
    `${chalk.bold('Local plugin code')}: ${report.plugins.localCodeExecution ? 'can run' : 'will not run'}`,
  );
  console.log(chalk.dim(`  ${report.plugins.note}`));
  console.log();
  console.log(chalk.bold('Local write surfaces'));
  for (const surface of report.localWrites.surfaces) {
    const userData = surface.containsUserData ? 'may contain repo data' : 'setup metadata';
    console.log(`- ${surface.name}: ${surface.path} (${userData}; ${surface.trigger})`);
  }
  console.log();
  console.log(chalk.bold('Report exports'));
  console.log(`- user controlled: ${report.reportExports.userControlled ? 'yes' : 'no'}`);
  console.log(`- may contain paths: ${report.reportExports.mayContainPaths ? 'yes' : 'no'}`);
  console.log(`- may contain findings: ${report.reportExports.mayContainFindings ? 'yes' : 'no'}`);
  console.log(chalk.dim(`  ${report.reportExports.note}`));
  console.log();
  console.log(chalk.bold('Network endpoints'));
  for (const endpoint of report.network.endpoints) {
    const blocked = endpoint.blockedByOffline
      ? 'blocked by offline mode'
      : 'available only if triggered';
    console.log(`- ${endpoint.name}: ${endpoint.endpoint} (${blocked})`);
  }
}
