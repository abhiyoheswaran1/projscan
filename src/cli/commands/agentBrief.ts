import chalk from 'chalk';

import {
  assertFormatSupported,
  getRootPath,
  maybeCompactBanner,
  program,
  setupLogLevel,
} from '../_shared.js';
import { computeAgentBrief } from '../../core/agentBrief.js';
import type { AgentBriefIntent, AgentBriefItem, AgentBriefReport } from '../../types.js';

const INTENTS: readonly AgentBriefIntent[] = [
  'next_agent',
  'bug_hunt',
  'release',
  'refactor',
  'hardening',
];

export function registerAgentBrief(): void {
  program
    .command('agent-brief')
    .description('Create a compact next-agent context packet with focus items and guardrails')
    .option(
      '--intent <intent>',
      'next_agent, bug_hunt, release, refactor, or hardening',
      'next_agent',
    )
    .option('--max-items <count>', 'maximum focus items to return', parsePositiveInt)
    .action(async (cmdOpts) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('agent-brief');
      const intent = parseIntent(cmdOpts.intent);

      try {
        const report = await computeAgentBrief(getRootPath(), {
          intent,
          maxItems: cmdOpts.maxItems,
        });

        if (format === 'json') {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        printAgentBrief(report);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    });
}

function printAgentBrief(report: AgentBriefReport): void {
  console.log(chalk.bold(`Agent Brief: ${report.intent}`));
  console.log(report.summary);
  console.log('');
  console.log(chalk.bold('Focus'));
  for (const item of report.focus) {
    printFocusItem(item);
  }
  console.log('');
  console.log(chalk.bold('Guardrails'));
  for (const guardrail of report.guardrails) {
    console.log(`- ${guardrail.label}: ${guardrail.command}`);
  }
}

function printFocusItem(item: AgentBriefItem): void {
  const files = item.files.length > 0 ? ` (${item.files.join(', ')})` : '';
  console.log(`- ${chalk.bold(`[${item.priority}] ${item.title}`)}${files}`);
  console.log(`  ${item.why}`);
  console.log(`  run: ${item.commands.join(' && ')}`);
}

function parseIntent(value: unknown): AgentBriefIntent {
  if (typeof value === 'string' && (INTENTS as readonly string[]).includes(value)) {
    return value as AgentBriefIntent;
  }
  console.error(chalk.red(`Unsupported --intent ${String(value)}.`));
  console.error(chalk.dim('Supported intents: next_agent, bug_hunt, release, refactor, hardening'));
  process.exit(1);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('value must be a positive integer');
  }
  return parsed;
}
