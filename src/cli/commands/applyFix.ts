import chalk from 'chalk';

import { program, getRootPath, getFormat, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { findIssue, buildApplyPlanForIssue } from '../../core/fixSuggest.js';
import { executePlan, rollback, type ApplyResult } from '../../core/applyFix.js';

/**
 * `projscan apply-fix <issue_id>` (1.6+) — execute the mechanical fix
 * for an issue. Default is dry-run; pass --confirm to write to disk.
 *
 * `projscan apply-fix --rollback <id>` — reverse a prior apply.
 */
export function registerApplyFix(): void {
  program
    .command('apply-fix [issueId]')
    .description('Apply a mechanical fix for an open issue (dry-run by default; --confirm to write)')
    .option('--confirm', 'actually write to disk (default is dry-run)')
    .option('--rollback <id>', 'reverse a previous apply by rollback id')
    .action(async (issueId: string | undefined, opts: { confirm?: boolean; rollback?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      const format = getFormat();
      try {
        if (opts.rollback) {
          const result = await rollback(rootPath, opts.rollback);
          renderResult(result, format, true);
          if (!result.ok) process.exit(1);
          return;
        }
        if (!issueId) {
          console.error(
            chalk.red(
              'apply-fix needs an issue id (e.g. `projscan apply-fix unused-dependency-foo`).',
            ),
          );
          console.error(chalk.dim('  Get one from `projscan doctor` or `projscan analyze`.'));
          process.exit(1);
          return;
        }
        const scan = await scanRepository(rootPath);
        const issues = await collectIssues(rootPath, scan.files);
        const issue = findIssue(issues, issueId);
        if (!issue) {
          console.error(chalk.red(`No open issue with id "${issueId}".`));
          console.error(chalk.dim('  The issue may have been resolved or the id may be stale.'));
          process.exit(1);
          return;
        }
        const plan = await buildApplyPlanForIssue(issue, rootPath);
        if (!plan) {
          console.error(
            chalk.yellow(
              `Issue "${issueId}" does not have apply support yet — only mechanical templates can be auto-applied.`,
            ),
          );
          console.error(
            chalk.dim(`  Try \`projscan fix-suggest ${issueId}\` for the structured guidance.`),
          );
          process.exit(1);
          return;
        }
        const dryRun = opts.confirm !== true;
        const result = await executePlan(rootPath, plan, { dryRun });
        if (format === 'json') {
          console.log(JSON.stringify({ ...result, summary: plan.summary }, null, 2));
        } else {
          renderApplyResult(result, plan.summary, dryRun);
        }
        if (!result.ok) process.exit(1);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function renderApplyResult(result: ApplyResult, summary: string, dryRun: boolean): void {
  console.log('');
  console.log(chalk.bold(dryRun ? 'Apply (dry-run)' : 'Apply'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  ${chalk.bold('Plan:')} ${summary}`);
  console.log('');
  if (!result.ok) {
    console.log(`  ${chalk.red('✗')} ${result.reason ?? 'apply failed'}`);
    return;
  }
  for (const c of result.changes) {
    const opTag =
      c.op === 'create' ? chalk.green('+') : c.op === 'delete' ? chalk.red('-') : chalk.yellow('~');
    console.log(`  ${opTag} ${c.op.padEnd(7)} ${c.path}`);
  }
  console.log('');
  if (dryRun) {
    console.log(chalk.dim('  Dry-run only. Re-run with --confirm to write.'));
  } else {
    console.log(chalk.green(`  ✓ Applied. Rollback id: ${result.rollbackId}`));
    console.log(chalk.dim('  Reverse with `projscan apply-fix --rollback ' + result.rollbackId + '`.'));
  }
}

function renderResult(result: ApplyResult, format: string, isRollback: boolean): void {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log('');
  console.log(chalk.bold(isRollback ? 'Rollback' : 'Apply'));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (!result.ok) {
    console.log(`  ${chalk.red('✗')} ${result.reason ?? 'failed'}`);
    return;
  }
  for (const c of result.changes) {
    const opTag =
      c.op === 'create' ? chalk.green('+') : c.op === 'delete' ? chalk.red('-') : chalk.yellow('~');
    console.log(`  ${opTag} ${c.op.padEnd(7)} ${c.path}`);
  }
  console.log('');
  console.log(chalk.green(`  ✓ ${isRollback ? 'Rolled back.' : 'Applied.'}`));
}
