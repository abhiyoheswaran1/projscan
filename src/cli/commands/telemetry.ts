import chalk from 'chalk';

import {
  disableTelemetry,
  enableTelemetry,
  explainTelemetryPolicy,
  getTelemetryStatus,
} from '../../core/telemetry.js';
import { assertFormatSupported, maybeCompactBanner, program, setupLogLevel } from '../_shared.js';

export function registerTelemetry(): void {
  const telemetry = program
    .command('telemetry')
    .description('Manage explicit opt-in anonymous product telemetry')
    .action(async () => {
      await runStatus('telemetry');
    });

  telemetry
    .command('status')
    .description('Show whether anonymous product telemetry is enabled')
    .action(async () => {
      await runStatus('telemetry status');
    });

  telemetry
    .command('enable')
    .description('Opt in to anonymous product-health telemetry')
    .option('--endpoint <url>', 'telemetry endpoint override')
    .action(async (opts: { endpoint?: string }) => {
      await runEnable(opts.endpoint);
    });

  telemetry
    .command('disable')
    .description('Opt out of telemetry and clear queued events')
    .action(async () => {
      await runDisable();
    });

  telemetry
    .command('explain')
    .description('Explain exactly what telemetry collects and never collects')
    .action(async () => {
      await runExplain();
    });
}

async function runStatus(commandName: 'telemetry' | 'telemetry status'): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported(commandName);
  try {
    const status = await getTelemetryStatus();
    if (format === 'json') {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    printStatus(status);
  } catch (error) {
    printError(error);
  }
}

async function runEnable(endpoint: string | undefined): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('telemetry enable');
  try {
    const status = await enableTelemetry({ endpoint });
    if (format === 'json') {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    console.log('');
    console.log(chalk.green('Telemetry enabled.'));
    console.log(
      chalk.dim(
        'Anonymous product-health events may now be sent; source code, paths, repo names, package names, and raw findings are never collected.',
      ),
    );
    console.log(chalk.dim('Endpoint: ' + status.endpoint));
    console.log(chalk.dim('Disable any time with: projscan telemetry disable'));
  } catch (error) {
    printError(error);
  }
}

async function runDisable(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('telemetry disable');
  try {
    const status = await disableTelemetry();
    if (format === 'json') {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    console.log('');
    console.log(chalk.green('Telemetry disabled.'));
    console.log(chalk.dim('The local queue was cleared and the anonymous id was removed.'));
  } catch (error) {
    printError(error);
  }
}

async function runExplain(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('telemetry explain');
  const policy = explainTelemetryPolicy();
  if (format === 'json') {
    console.log(JSON.stringify(policy, null, 2));
    return;
  }
  console.log('');
  console.log(chalk.bold('projscan telemetry'));
  console.log(chalk.dim('Default: off. No silent telemetry.'));
  console.log('');
  console.log(chalk.bold('Collected when enabled'));
  for (const item of policy.collected) console.log('  ' + item);
  console.log('');
  console.log(chalk.bold('Never collected'));
  for (const item of policy.neverCollected) console.log('  ' + item);
  console.log('');
  console.log(chalk.bold('Controls'));
  for (const command of policy.controls) console.log('  ' + command);
}

function printStatus(status: Awaited<ReturnType<typeof getTelemetryStatus>>): void {
  console.log('');
  console.log(
    chalk.bold('Telemetry: ') +
      (status.enabled ? chalk.green('enabled') : chalk.yellow('disabled')),
  );
  console.log(
    chalk.dim(
      'Default is off. No code, paths, repo names, package names, raw findings, secrets, usernames, or emails are collected.',
    ),
  );
  console.log(chalk.dim('Endpoint: ' + status.endpoint));
  console.log(chalk.dim('Queued events: ' + status.queueLength));
  console.log('');
  console.log(chalk.bold('Next Commands'));
  for (const command of status.nextCommands) console.log('  ' + command);
}

function printError(error: unknown): never {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
