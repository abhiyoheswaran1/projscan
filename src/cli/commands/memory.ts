import chalk from 'chalk';

import { program, getRootPath, getFormat, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import {
  findStableRules,
  forgetRule,
  loadMemory,
  saveMemory,
  type ProjectMemory,
  type RuleObservation,
} from '../../core/memory.js';

/**
 * `projscan memory` — inspect or prune the local Project Memory store
 * that learns which analyzer rules this repo has been carrying across
 * many runs.
 *
 *   projscan memory                  — aggregate summary (default)
 *   projscan memory stable           — long-running rules + .projscanrc snippet
 *   projscan memory runs             — every tracked rule with full history
 *   projscan memory forget <rule>    — drop a single rule's history
 */
export function registerMemory(): void {
  const memory = program
    .command('memory')
    .description('Inspect or prune the local Project Memory (1.5+)')
    .action(async () => {
      await runSummary();
    });

  memory
    .command('stable')
    .description('Show rules that have been surfacing across enough runs to count as accepted')
    .action(async () => {
      await runStable();
    });

  memory
    .command('runs')
    .description('Show every tracked rule with its observation history')
    .action(async () => {
      await runRuns();
    });

  memory
    .command('forget <rule>')
    .description("Drop a single rule's history from memory")
    .action(async (rule: string) => {
      await runForget(rule);
    });
}

async function runSummary(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const m = await loadMemory(rootPath);
    if (format === 'json') {
      console.log(JSON.stringify(summarize(m), null, 2));
      return;
    }
    printSummary(m);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runStable(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const m = await loadMemory(rootPath);
    const stable = findStableRules(m);
    if (format === 'json') {
      console.log(JSON.stringify({ totalRuns: m.totalRuns, stable }, null, 2));
      return;
    }
    printStable(m, stable);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runRuns(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const m = await loadMemory(rootPath);
    const all = Object.values(m.rules).sort((a, b) => b.runCount - a.runCount);
    if (format === 'json') {
      console.log(JSON.stringify({ totalRuns: m.totalRuns, rules: all }, null, 2));
      return;
    }
    printRuns(m, all);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runForget(rule: string): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  try {
    const m = await loadMemory(rootPath);
    const existed = forgetRule(m, rule);
    if (existed) {
      await saveMemory(rootPath, m);
      console.log(chalk.green(`✓ Dropped "${rule}" from memory.`));
    } else {
      console.log(chalk.dim(`No memory entry for "${rule}".`));
    }
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function summarize(m: ProjectMemory): Record<string, unknown> {
  return {
    totalRuns: m.totalRuns,
    rulesTracked: Object.keys(m.rules).length,
    stableRuleCount: findStableRules(m).length,
    lastUpdatedAt: m.lastUpdatedAt,
  };
}

function printSummary(m: ProjectMemory): void {
  const stableCount = findStableRules(m).length;
  console.log('');
  console.log(chalk.bold('Project Memory'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  total runs:    ${m.totalRuns}`);
  console.log(`  rules tracked: ${Object.keys(m.rules).length}`);
  console.log(
    `  stable rules:  ${stableCount > 0 ? chalk.yellow(stableCount) : '0'} ${chalk.dim('(unfixed across many runs)')}`,
  );
  console.log(`  last updated:  ${m.lastUpdatedAt}`);
  if (stableCount > 0) {
    console.log('');
    console.log(
      chalk.dim(
        '  Tip: run `projscan memory stable` to see which rules to consider disabling in .projscanrc.',
      ),
    );
  }
}

function printStable(m: ProjectMemory, stable: RuleObservation[]): void {
  console.log('');
  console.log(chalk.bold('Stable rules (effectively accepted)'));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (stable.length === 0) {
    console.log(chalk.dim('  No stable rules yet — they appear after a rule has surfaced across'));
    console.log(chalk.dim('  ≥ 3 runs over ≥ 7 days without ever being fixed.'));
    return;
  }
  for (const r of stable) {
    console.log(
      `  ${chalk.yellow('▲')} ${chalk.bold(r.ruleId)}  ${chalk.dim(`(seen in ${r.runCount} runs since ${r.firstSeenAt.slice(0, 10)})`)}`,
    );
  }
  console.log('');
  console.log(chalk.bold('  Suggested .projscanrc.json:'));
  console.log('');
  console.log('  ' + JSON.stringify({ disableRules: stable.map((r) => r.ruleId) }, null, 2).split('\n').join('\n  '));
}

function printRuns(m: ProjectMemory, all: RuleObservation[]): void {
  console.log('');
  console.log(chalk.bold(`Tracked rules (${all.length})`));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (all.length === 0) {
    console.log(chalk.dim('  No rules tracked yet. Memory begins recording on `projscan doctor` runs.'));
    return;
  }
  for (const r of all.slice(0, 30)) {
    const status = r.suppressedInConfig
      ? chalk.dim('[suppressed]')
      : r.fixedCount > 0
        ? chalk.green(`[fixed ×${r.fixedCount}]`)
        : chalk.dim('[active]');
    console.log(`  runs ${String(r.runCount).padStart(3)}  ${status} ${r.ruleId}`);
  }
  if (all.length > 30) {
    console.log(chalk.dim(`  ... and ${all.length - 30} more`));
  }
}
