import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { explainIssue } from '../../core/explainIssue.js';
import { reportExplainIssue } from '../../reporters/consoleReporter.js';
import { reportExplainIssueJson } from '../../reporters/jsonReporter.js';
import { reportExplainIssueMarkdown } from '../../reporters/markdownReporter.js';

export function registerExplainIssue(): void {
  program
    .command('explain-issue <issue_id>')
    .description('Deep dive on one open issue: code excerpt, related issues, past fixes, suggested action')
    .action(async (issueId: string) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Resolving issue context...').start() : null;

      try {
        const scan = await scanRepository(rootPath);
        const issues = await collectIssues(rootPath, scan.files);
        const explanation = await explainIssue(rootPath, issues, issueId);
        if (spinner) spinner.stop();

        if (!explanation) {
          console.error(chalk.red(`\n  No open issue with id "${issueId}" in current doctor run.\n`));
          process.exit(1);
        }

        switch (format) {
          case 'json':
            reportExplainIssueJson(explanation);
            break;
          case 'markdown':
            reportExplainIssueMarkdown(explanation);
            break;
          default:
            reportExplainIssue(explanation);
        }
      } catch (error) {
        if (spinner) spinner.fail('explain-issue failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
