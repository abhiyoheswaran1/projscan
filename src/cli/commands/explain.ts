import chalk from 'chalk';
import path from 'node:path';

import { program, setupLogLevel, maybeCompactBanner, analyzeFile, assertFormatSupported } from '../_shared.js';
import { reportExplanation } from '../../reporters/consoleReporter.js';
import { reportExplanationJson } from '../../reporters/jsonReporter.js';
import { reportExplanationMarkdown } from '../../reporters/markdownReporter.js';
import { formatCliDeprecationNotice } from '../../core/deprecations.js';

export function registerExplain(): void {
  program
    .command('explain <file>')
    .description('Explain a file - its purpose, dependencies, and exports')
    .action(async (filePath: string) => {
      setupLogLevel();
      maybeCompactBanner();
      console.error(
        chalk.yellow(
          formatCliDeprecationNotice('explain', {
            since: '3.8.0',
            replacedBy: 'projscan file',
            note: 'projscan file is a strict superset (adds churn, risk, ownership, and related health).',
          }),
        ),
      );
      const format = assertFormatSupported('explain');
      const absolutePath = path.resolve(filePath);

      try {
        const explanation = await analyzeFile(absolutePath);

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
        const message = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' || /not found/i.test(message)) {
          console.error(chalk.red(`File not found: ${filePath}`));
          console.error(
            chalk.dim(`  Tip: paths are repo-relative. Run \`projscan structure\` to see the file tree.`),
          );
        } else {
          console.error(chalk.red(message));
        }
        process.exit(1);
      }
    });
}
