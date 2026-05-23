import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import {
  computeFirstRunDiagnostics,
  getWorkflowRecipes,
  type FirstRunDiagnostic,
  type FirstRunReport,
  type WorkflowRecipeCatalog,
} from '../../core/adoption.js';

export function registerRecipes(): void {
  program
    .command('recipes')
    .description('Print agent workflow recipes for adopting projscan')
    .action(async () => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('recipes');
      const catalog = getWorkflowRecipes();
      if (format === 'json') {
        console.log(JSON.stringify(catalog, null, 2));
        return;
      }
      printRecipes(catalog);
    });
}

export function registerFirstRun(): void {
  program
    .command('first-run')
    .description('Diagnose first-run setup for CLI and MCP adoption')
    .action(async () => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('first-run');
      const report = await computeFirstRunDiagnostics(getRootPath());
      if (format === 'json') {
        console.log(JSON.stringify(report, null, 2));
        return;
      }
      printFirstRun(report);
    });
}

function printRecipes(catalog: WorkflowRecipeCatalog): void {
  console.log('');
  console.log(chalk.bold('Agent Workflow Recipes'));
  console.log(chalk.dim('────────────────────────────────────────'));
  for (const recipe of catalog.recipes) {
    console.log(`\n  ${chalk.bold(recipe.name)} ${chalk.dim(`(${recipe.id})`)}`);
    console.log(`  ${recipe.useWhen}`);
    console.log(chalk.dim(`  outcome: ${recipe.outcome}`));
    console.log(`  commands:`);
    for (const command of recipe.commands) {
      console.log(`    ${chalk.cyan(command)}`);
    }
    console.log(chalk.dim(`  MCP tools: ${recipe.mcpTools.join(', ')}`));
    console.log(chalk.dim(`  handoff: ${recipe.handoff}`));
  }
  console.log('');
}

function printFirstRun(report: FirstRunReport): void {
  console.log('');
  console.log(chalk.bold('First-Run Diagnostics'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  overall: ${colorStatus(report.overall)(report.overall)}`);
  for (const diagnostic of report.diagnostics) {
    printDiagnostic(diagnostic);
  }
  console.log('');
  console.log(chalk.bold('Next commands'));
  for (const command of report.nextCommands) {
    console.log(`  ${chalk.cyan(command)}`);
  }
  console.log('');
}

function printDiagnostic(diagnostic: FirstRunDiagnostic): void {
  const color = colorStatus(diagnostic.status);
  console.log(`  ${color(symbolForStatus(diagnostic.status))} ${chalk.bold(diagnostic.label)}: ${diagnostic.summary}`);
  if (diagnostic.detail) console.log(chalk.dim(`      ${diagnostic.detail}`));
  if (diagnostic.command) console.log(chalk.dim(`      try: ${diagnostic.command}`));
}

function colorStatus(status: FirstRunDiagnostic['status']): (text: string) => string {
  if (status === 'fail') return chalk.red;
  if (status === 'warn') return chalk.yellow;
  if (status === 'pass') return chalk.green;
  return chalk.cyan;
}

function symbolForStatus(status: FirstRunDiagnostic['status']): string {
  if (status === 'fail') return '✗';
  if (status === 'warn') return '!';
  if (status === 'pass') return '✓';
  return 'i';
}
