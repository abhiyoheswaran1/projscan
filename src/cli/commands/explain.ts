import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs/promises';

import { program, getFormat, setupLogLevel, maybeCompactBanner, analyzeFile } from '../_shared.js';
import { reportExplanation } from '../../reporters/consoleReporter.js';
import { reportExplanationJson } from '../../reporters/jsonReporter.js';
import { reportExplanationMarkdown } from '../../reporters/markdownReporter.js';

export function registerExplain(): void {
  program
    .command('explain <file>')
    .description('Explain a file - its purpose, dependencies, and exports')
    .action(async (filePath: string) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = getFormat();
      const absolutePath = path.resolve(filePath);

      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const explanation = analyzeFile(absolutePath, content);

        switch (format) {
          case 'json':
            reportExplanationJson(explanation);
            break;
          case 'markdown':
            reportExplanationMarkdown(explanation);
            break;
          default:
            reportExplanation(explanation);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          console.error(chalk.red(`File not found: ${filePath}`));
        } else {
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        }
        process.exit(1);
      }
    });
}
