import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { computeStartReport } from '../../core/start.js';
import {
  disableTelemetry,
  enableTelemetry,
  getTelemetryOptInPrompt,
  getTelemetryStatus,
  type TelemetryStatus,
} from '../../core/telemetry.js';
import {
  program,
  getRootPath,
  setupLogLevel,
  maybeCompactBanner,
  assertFormatSupported,
  promptYesNo,
} from '../_shared.js';
import {
  getGithubActionStarter,
  getMcpConfigGuide,
  isMcpClientId,
  isPolicyStarterTeam,
  MCP_CLIENT_IDS,
  POLICY_STARTER_TEAMS,
  writeGithubActionStarter,
  writePolicyStarterKit,
  writeTeamStarterKit,
  type McpConfigCatalog,
  type McpConfigGuide,
  type PolicyStarterTeam,
  type TeamStarterKit,
  type WriteGithubActionStarterResult,
  type WritePolicyStarterResult,
} from '../../core/adoption.js';
import type { StartReport } from '../../types/start.js';

/**
 * `projscan init` (1.6+) — scaffold `.projscanrc.json` for new
 * adopters. Idempotent: if the config already exists, prints a diff
 * against the suggested defaults instead of overwriting.
 */
export function registerInit(): void {
  const init = program
    .command('init')
    .description('Scaffold .projscanrc.json with sensible defaults (1.6+)')
    .option('--force', 'overwrite an existing .projscanrc.json (default: refuse)')
    .action(async (opts: { force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      assertFormatSupported('init');
      const rootPath = getRootPath();
      try {
        await runInit(rootPath, opts.force === true);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  init
    .command('github-action')
    .description('Write a GitHub Actions workflow that posts projscan PR evidence')
    .option('--force', 'overwrite an existing .github/workflows/projscan.yml')
    .action(async (opts: { force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('init github-action');
      try {
        const result = await writeGithubActionStarter(getRootPath(), {
          force: opts.force === true,
        });
        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        printGithubActionStarterResult(result);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  init
    .command('policy')
    .description('Write a team policy starter .projscanrc.json')
    .option('--team <team>', `team: ${POLICY_STARTER_TEAMS.join(', ')}`, 'platform')
    .option('--force', 'overwrite an existing .projscanrc.json')
    .action(async (opts: { team?: string; force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('init policy');
      const team = parsePolicyTeam(opts.team);
      try {
        const result = await writePolicyStarterKit(getRootPath(), team, {
          force: opts.force === true,
        });
        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        printPolicyStarterResult(result);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  init
    .command('team')
    .description(
      'Bootstrap team policy, PR workflow, CODEOWNERS starter, baseline memory, and a start report',
    )
    .option('--team <team>', `team: ${POLICY_STARTER_TEAMS.join(', ')}`, 'platform')
    .option('--force', 'overwrite existing starter files')
    .action(async (opts: { team?: string; force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('init team');
      const team = parsePolicyTeam(opts.team);
      try {
        const rootPath = getRootPath();
        const telemetryStatus = await getTelemetryStatus();
        const result = {
          schemaVersion: 1,
          team: await writeTeamStarterKit(rootPath, team, { force: opts.force === true }),
          start: await computeStartReport(rootPath, {
            mode: 'before_edit',
            maxTasks: 5,
            maxRisks: 5,
          }),
          telemetry: {
            status: telemetryStatus,
            prompt: getTelemetryOptInPrompt(),
          },
        };
        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        printTeamStarterResult(result);
        await maybePromptTelemetryOptIn(format, telemetryStatus);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  init
    .command('mcp')
    .description('Print ready-to-paste MCP client config snippets')
    .option('--client <client>', `client: ${MCP_CLIENT_IDS.join(', ')}`, 'all')
    .action(async (opts: { client?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('init mcp');
      const client = opts.client ?? 'all';
      if (!isMcpClientId(client)) {
        console.error(chalk.red(`Unsupported --client ${client}.`));
        console.error(chalk.dim(`Supported clients: ${MCP_CLIENT_IDS.join(', ')}`));
        process.exit(1);
      }
      const guide = getMcpConfigGuide(client);
      if (format === 'json') {
        console.log(JSON.stringify(guide, null, 2));
        return;
      }
      printMcpGuide(guide);
    });
}

const DEFAULT_CONFIG = {
  minScore: 70,
  hotspots: { limit: 10 },
  ignore: [],
  disableRules: [],
};

async function runInit(rootPath: string, force: boolean): Promise<void> {
  const target = path.join(rootPath, '.projscanrc.json');
  let exists = false;
  try {
    await fs.access(target);
    exists = true;
  } catch {
    // not present
  }

  if (exists && !force) {
    console.log('');
    console.log(chalk.yellow('⚠ .projscanrc.json already exists. Refusing to overwrite.'));
    console.log(
      chalk.dim('  Pass --force to overwrite, or merge manually with the defaults below:'),
    );
    console.log('');
    console.log(prefixIndent(JSON.stringify(DEFAULT_CONFIG, null, 2), '  '));
    console.log('');
    console.log(
      chalk.dim(
        '  See https://github.com/abhiyoheswaran1/projscan#projscanrc for the field reference.',
      ),
    );
    return;
  }

  const content = JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n';
  await fs.writeFile(target, content, 'utf-8');
  console.log('');
  console.log(chalk.green('✓ Created .projscanrc.json'));
  console.log('');
  console.log(prefixIndent(content.trimEnd(), '  '));
  console.log('');
  console.log(chalk.dim('  Tune the score threshold, ignore globs, or disabled rules as needed.'));
  console.log(chalk.dim('  Then run `projscan ci --min-score 70` (or whatever you set).'));
}

function printGithubActionStarterResult(result: WriteGithubActionStarterResult): void {
  console.log('');
  if (result.created) {
    console.log(chalk.green(`✓ Created ${result.filename}`));
  } else {
    console.log(chalk.yellow(`⚠ ${result.reason ?? 'GitHub Action starter was not written.'}`));
    console.log(chalk.dim('  Pass --force to overwrite the existing workflow.'));
  }
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const command of result.nextCommands) console.log(`  ${command}`);
  console.log('');
  console.log(chalk.bold('Workflow Preview'));
  console.log(prefixIndent(getGithubActionStarter().workflow.trimEnd(), '  '));
}

function parsePolicyTeam(value: unknown): PolicyStarterTeam {
  if (isPolicyStarterTeam(value)) return value;
  console.error(chalk.red(`Unsupported --team ${String(value)}.`));
  console.error(chalk.dim(`Supported teams: ${POLICY_STARTER_TEAMS.join(', ')}`));
  process.exit(1);
}

function printPolicyStarterResult(result: WritePolicyStarterResult): void {
  console.log('');
  if (result.created) {
    console.log(chalk.green(`✓ Created .projscanrc.json for ${result.label}`));
  } else {
    console.log(chalk.yellow(`⚠ ${result.reason ?? 'Policy starter was not written.'}`));
    console.log(chalk.dim('  Pass --force to overwrite with the selected policy starter.'));
  }
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const command of result.nextCommands) console.log(`  ${command}`);
  console.log('');
  console.log(chalk.bold('Policy'));
  console.log(prefixIndent(JSON.stringify(result.config, null, 2), '  '));
}

function printTeamStarterResult(result: {
  schemaVersion: number;
  team: TeamStarterKit;
  start: StartReport;
  telemetry?: { status: TelemetryStatus; prompt: string };
}): void {
  console.log('');
  console.log(chalk.bold(`Team Bootstrap: ${result.team.team}`));
  console.log(
    `  policy       ${result.team.created.policy ? chalk.green('created') : chalk.yellow('kept')}`,
  );
  console.log(
    `  PR workflow  ${result.team.created.githubAction ? chalk.green('created') : chalk.yellow('kept')}`,
  );
  console.log(
    `  CODEOWNERS   ${result.team.created.codeowners ? chalk.green('created') : chalk.yellow('kept')}`,
  );
  console.log(
    `  baseline     ${result.team.created.baseline ? chalk.green('created') : chalk.yellow('kept')}`,
  );
  if (result.team.reasons.length > 0) {
    console.log('');
    for (const reason of result.team.reasons) console.log(chalk.dim(`  ${reason}`));
  }
  console.log('');
  console.log(chalk.bold('Start Summary'));
  console.log(`  ${result.start.summary}`);
  console.log('');
  console.log(chalk.bold('Onboarding'));
  for (const step of result.team.onboarding) {
    console.log(`  ${step.title}`);
    console.log(chalk.dim(`    ${step.why}`));
    if (step.command) console.log(`    ${step.command}`);
  }
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const command of result.team.nextCommands) console.log(`  ${command}`);
  if (result.telemetry) {
    console.log('');
    console.log(chalk.bold('Telemetry'));
    console.log(
      `  ${result.telemetry.status.enabled ? 'enabled' : 'disabled'} (default is off; run projscan telemetry explain)`,
    );
  }
}

async function maybePromptTelemetryOptIn(format: string, status: TelemetryStatus): Promise<void> {
  if (format !== 'console') return;
  if (program.opts().quiet) return;
  if (status.enabled) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;
  console.log('');
  const yes = await promptYesNo(getTelemetryOptInPrompt());
  if (yes) {
    await enableTelemetry();
    console.log(chalk.green('Telemetry enabled.'));
  } else {
    await disableTelemetry();
    console.log(
      chalk.dim(
        'Telemetry remains disabled. You can enable it later with projscan telemetry enable.',
      ),
    );
  }
}

function prefixIndent(text: string, indent: string): string {
  return text
    .split('\n')
    .map((l) => indent + l)
    .join('\n');
}

function printMcpGuide(guide: McpConfigCatalog | McpConfigGuide): void {
  console.log('');
  console.log(chalk.bold('MCP Client Config'));
  console.log(chalk.dim('────────────────────────────────────────'));
  console.log(`  install: ${chalk.cyan(guide.install.command)}`);
  console.log(`  server : ${chalk.cyan(guide.install.mcpServerCommand)}`);
  console.log('');

  if (guide.client === 'all') {
    for (const config of guide.configs) printSingleGuide(config);
    return;
  }
  printSingleGuide(guide);
}

function printSingleGuide(guide: McpConfigGuide): void {
  console.log(chalk.bold(`  ${guide.displayName}`));
  console.log(chalk.dim(`  ${guide.whereToPaste}`));
  console.log(prefixIndent(guide.configText, '    '));
  if (guide.notes.length > 0) {
    console.log(chalk.dim(`    note: ${guide.notes.join(' ')}`));
  }
  console.log('');
}
