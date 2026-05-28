import chalk from 'chalk';

import {
  program,
  getRootPath,
  assertFormatSupported,
  setupLogLevel,
  maybeCompactBanner,
} from '../_shared.js';
import {
  computeMcpSetupDoctor,
  isMcpClientId,
  MCP_CLIENT_IDS,
  type McpSetupDoctorReport,
} from '../../core/adoption.js';
import { setLogLevel } from '../../utils/logger.js';
import { runMcpServer } from '../../mcp/server.js';

export function registerMcp(): void {
  const mcp = program
    .command('mcp')
    .description('Run projscan as an MCP server (stdio) for AI coding agents')
    .option(
      '--watch',
      'emit notifications/file_changed when source files change (1.3+; off by default; agents that subscribe stop polling)',
    );

  mcp
    .command('doctor')
    .description('Verify MCP setup and print paste-ready client config')
    .option('--client <client>', `client: ${MCP_CLIENT_IDS.join(', ')}`, 'all')
    .action(async (opts: { client?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('mcp doctor');
      const client = opts.client ?? 'all';
      if (!isMcpClientId(client)) {
        console.error(chalk.red(`Unsupported --client ${client}.`));
        console.error(chalk.dim(`Supported clients: ${MCP_CLIENT_IDS.join(', ')}`));
        process.exit(1);
      }
      try {
        const report = await computeMcpSetupDoctor(getRootPath(), client);
        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printMcpDoctor(report);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  mcp.action(async (opts: { watch?: boolean }) => {
    assertFormatSupported('mcp');
    setLogLevel('quiet');
    const rootPath = getRootPath();
    try {
      await runMcpServer(rootPath, { watch: opts.watch === true });
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });
}

function printMcpDoctor(report: McpSetupDoctorReport): void {
  console.log('');
  console.log(chalk.bold(`MCP Doctor: ${report.client}`));
  console.log(`  status: ${statusColor(report.status)(report.status)}`);
  console.log(`  command: ${chalk.cyan(report.expected.command)}`);
  console.log(`  paste: ${report.whereToPaste}`);
  console.log('');
  console.log(chalk.bold('Checks'));
  for (const check of report.checks) {
    console.log(`  ${statusColor(check.status)(check.status)} ${check.id}: ${check.summary}`);
    if (check.detail) console.log(chalk.dim(`    ${check.detail}`));
  }
  console.log('');
  console.log(chalk.bold('Config'));
  console.log(prefixIndent(report.configText, '  '));
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const command of report.nextCommands) console.log(`  ${command}`);
}

function statusColor(status: McpSetupDoctorReport['status'] | McpSetupDoctorReport['checks'][number]['status']) {
  if (status === 'pass') return chalk.green;
  if (status === 'fail') return chalk.red;
  if (status === 'warn') return chalk.yellow;
  return chalk.dim;
}

function prefixIndent(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => indent + line)
    .join('\n');
}
