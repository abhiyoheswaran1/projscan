import ora from 'ora';
import chalk from 'chalk';

import { program, getFormat, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { findIssue, suggestFixForIssue, syntheticIssue } from '../../core/fixSuggest.js';
import type { FixSuggestion } from '../../types.js';
import { reportFixSuggest } from '../../reporters/consoleReporter.js';
import { reportFixSuggestJson } from '../../reporters/jsonReporter.js';
import { reportFixSuggestMarkdown } from '../../reporters/markdownReporter.js';

export function registerFixSuggest(): void {
  program
    .command('fix-suggest [issue_id]')
    .description('Get a structured fix-action prompt for an issue (rule-driven; no LLM inside projscan)')
    .option('--file <path>', 'when no issue_id given: file the rule applies to')
    .option('--rule <name>', 'when no issue_id given: rule / issue-id prefix')
    .option('--severity <level>', 'severity for synthesized requests (info | warning | error)', 'warning')
    .action(async (issueId: string | undefined, cmdOpts: { file?: string; rule?: string; severity?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      const spinner = format === 'console' ? ora('Resolving fix suggestion...').start() : null;

      try {
        let result: { matched: boolean; fix?: FixSuggestion; reason?: string; synthetic?: boolean };

        if (issueId) {
          const scan = await scanRepository(rootPath);
          const issues = await collectIssues(rootPath, scan.files);
          const found = findIssue(issues, issueId);
          if (!found) {
            result = { matched: false, reason: `No open issue with id "${issueId}" in current doctor run.` };
          } else {
            const fix = await suggestFixForIssue(found, rootPath);
            result = { matched: true, fix };
          }
        } else if (cmdOpts.file && cmdOpts.rule) {
          const sev =
            cmdOpts.severity === 'info' || cmdOpts.severity === 'warning' || cmdOpts.severity === 'error'
              ? cmdOpts.severity
              : 'warning';
          const synthetic = syntheticIssue(cmdOpts.rule, cmdOpts.file, sev);
          const fix = await suggestFixForIssue(synthetic, rootPath);
          result = { matched: true, fix, synthetic: true };
        } else {
          result = { matched: false, reason: 'Provide either an <issue_id> argument or both --file and --rule.' };
        }

        if (spinner) spinner.stop();

        switch (format) {
          case 'json':
            reportFixSuggestJson(result);
            break;
          case 'markdown':
            reportFixSuggestMarkdown(result);
            break;
          default:
            reportFixSuggest(result);
        }

        if (!result.matched) process.exitCode = 1;
      } catch (error) {
        if (spinner) spinner.fail('fix-suggest failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
