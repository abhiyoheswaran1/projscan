import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';

/**
 * `projscan init` (1.6+) — scaffold `.projscanrc.json` for new
 * adopters. Idempotent: if the config already exists, prints a diff
 * against the suggested defaults instead of overwriting.
 */
export function registerInit(): void {
  program
    .command('init')
    .description('Scaffold .projscanrc.json with sensible defaults (1.6+)')
    .option('--force', 'overwrite an existing .projscanrc.json (default: refuse)')
    .action(async (opts: { force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      try {
        await runInit(rootPath, opts.force === true);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
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
    console.log(chalk.dim('  Pass --force to overwrite, or merge manually with the defaults below:'));
    console.log('');
    console.log(prefixIndent(JSON.stringify(DEFAULT_CONFIG, null, 2), '  '));
    console.log('');
    console.log(
      chalk.dim('  See https://github.com/abhiyoheswaran1/projscan#projscanrc for the field reference.'),
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

function prefixIndent(text: string, indent: string): string {
  return text
    .split('\n')
    .map((l) => indent + l)
    .join('\n');
}
