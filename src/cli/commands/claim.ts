import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner, assertFormatSupported } from '../_shared.js';
import { addClaim, listClaims, releaseClaim, findContendedClaims } from '../../core/claims.js';

/**
 * `projscan claim` (4.x) — advisory claims/leases so parallel agents see who
 * owns which file, directory, or symbol. Shared across the repo's worktrees.
 */
export function registerClaim(): void {
  const claim = program
    .command('claim')
    .description('Advisory claims/leases for coordinating parallel agents')
    .action(async () => {
      await runList();
    });

  claim
    .command('list')
    .description('List active claims across the repo worktrees')
    .action(async () => {
      await runList();
    });

  claim
    .command('add <target>')
    .description('Claim a file, directory, or symbol')
    .requiredOption('--agent <name>', 'agent holding the claim')
    .option('--note <text>', 'optional note')
    .action(async (target: string, cmdOpts: { agent: string; note?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('claim add');
      const rootPath = getRootPath();
      const result = await addClaim(rootPath, {
        target,
        agent: cmdOpts.agent,
        ...(cmdOpts.note ? { note: cmdOpts.note } : {}),
      });
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`${chalk.green('✓')} claimed ${chalk.bold(result.claim.target)} for ${chalk.bold(result.claim.agent)}`);
      if (result.contention.length > 0) {
        console.log(
          chalk.yellow(`  ⚠ contention: also held by ${result.contention.map((c) => `${c.agent} (${c.target})`).join(', ')}`),
        );
      }
    });

  claim
    .command('release [id]')
    .description('Release a claim by id, or by --target / --agent')
    .option('--target <target>', 'release claims on this target')
    .option('--agent <name>', 'release this agent\'s claims (or scope --target to it)')
    .action(async (id: string | undefined, cmdOpts: { target?: string; agent?: string }) => {
      setupLogLevel();
      maybeCompactBanner();
      const format = assertFormatSupported('claim release');
      const rootPath = getRootPath();
      if (!id && !cmdOpts.target && !cmdOpts.agent) {
        const message = 'release needs an <id>, --target, or --agent.';
        if (format === 'json') console.log(JSON.stringify({ ok: false, error: message }, null, 2));
        else console.error(chalk.red(message));
        process.exit(1);
      }
      const released = await releaseClaim(rootPath, {
        ...(id ? { id } : {}),
        ...(cmdOpts.target ? { target: cmdOpts.target } : {}),
        ...(cmdOpts.agent ? { agent: cmdOpts.agent } : {}),
      });
      if (format === 'json') {
        console.log(JSON.stringify({ ok: true, released }, null, 2));
        return;
      }
      console.log(
        released.length > 0
          ? `${chalk.green('✓')} released ${released.length} claim(s)`
          : chalk.dim('  no matching claims to release'),
      );
    });
}

async function runList(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const format = assertFormatSupported('claim list');
  const rootPath = getRootPath();
  const claims = await listClaims(rootPath);
  if (format === 'json') {
    console.log(JSON.stringify({ claims }, null, 2));
    return;
  }
  console.log('');
  console.log(chalk.bold('Claims'));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (claims.length === 0) {
    console.log(chalk.dim('  no active claims'));
    return;
  }
  for (const c of claims) {
    console.log(`  ${chalk.bold(c.target)} ${chalk.dim(`— ${c.agent}`)}${c.note ? chalk.dim(`  (${c.note})`) : ''}`);
    console.log(chalk.dim(`      ${c.id}`));
  }
  // Surface any overlapping holders so contention is visible at a glance.
  const contendedTargets = new Set(findContendedClaims(claims).map((c) => c.target));
  if (contendedTargets.size > 0) {
    console.log('');
    console.log(chalk.yellow(`  ⚠ ${contendedTargets.size} target(s) claimed by more than one agent`));
  }
}
