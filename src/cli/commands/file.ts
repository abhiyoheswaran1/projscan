import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { inspectFile } from '../../core/fileInspector.js';
import { reportFileInspection } from '../../reporters/consoleReporter.js';
import { reportFileJson } from '../../reporters/jsonReporter.js';
import { reportFileMarkdown } from '../../reporters/markdownReporter.js';

export function registerFile(): void {
  program
    .command('file <file>')
    .description('Drill into a file - purpose, risk, ownership, related issues')
    .action(async (filePath: string) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Inspecting file...').start() : null;

      try {
        const inspection = await inspectFile(rootPath, filePath);
        if (spinner) spinner.stop();

        if (!inspection.exists) {
          console.error(chalk.red(`\n  ${inspection.reason ?? 'File unavailable'}: ${filePath}\n`));
          process.exit(1);
        }

        switch (format) {
          case 'json':
            reportFileJson(inspection);
            break;
          case 'markdown':
            reportFileMarkdown(inspection);
            break;
          default:
            reportFileInspection(inspection);
        }
      } catch (error) {
        if (spinner) spinner.fail('File inspection failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
