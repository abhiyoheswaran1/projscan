import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

import { program, getRootPath, setupLogLevel, maybeCompactBanner } from '../_shared.js';

/**
 * `projscan install-hook` (1.6+) — write `.git/hooks/pre-commit`
 * that runs `projscan ci --changed-only --min-score <threshold>`.
 *
 * Skipped if the cwd is not a git repository. Refuses to overwrite
 * an existing hook unless --force is passed; prints the new content
 * for manual merging if there's a conflict.
 */
export function registerInstallHook(): void {
  program
    .command('install-hook')
    .description('Install a pre-commit git hook running projscan ci --changed-only (1.6+)')
    .option('--threshold <n>', 'min-score threshold for the hook (default 70)', (v) => parseInt(v, 10))
    .option('--force', "overwrite an existing pre-commit hook (default: refuse)")
    .action(async (opts: { threshold?: number; force?: boolean }) => {
      setupLogLevel();
      maybeCompactBanner();
      const rootPath = getRootPath();
      try {
        await runInstallHook(rootPath, opts.threshold ?? 70, opts.force === true);
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

async function runInstallHook(rootPath: string, threshold: number, force: boolean): Promise<void> {
  const gitDir = path.join(rootPath, '.git');
  try {
    const stat = await fs.stat(gitDir);
    if (!stat.isDirectory()) throw new Error('not a git repo');
  } catch {
    console.error(chalk.red('✗ Not a git repository (no .git/ directory at the project root).'));
    process.exit(1);
    return;
  }

  const hooksDir = path.join(gitDir, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, 'pre-commit');

  const content = buildHookScript(threshold);
  let exists = false;
  try {
    await fs.access(hookPath);
    exists = true;
  } catch {
    // not present
  }

  if (exists && !force) {
    console.log('');
    console.log(chalk.yellow('⚠ .git/hooks/pre-commit already exists. Refusing to overwrite.'));
    console.log(chalk.dim('  Pass --force to overwrite, or merge manually with the script below:'));
    console.log('');
    console.log(prefixIndent(content, '  '));
    return;
  }

  await fs.writeFile(hookPath, content, 'utf-8');
  await fs.chmod(hookPath, 0o755);
  console.log('');
  console.log(chalk.green('✓ Installed .git/hooks/pre-commit'));
  console.log(chalk.dim(`  Threshold: ${threshold}/100. Runs \`projscan ci --changed-only\` on every commit.`));
  console.log(
    chalk.dim('  Skip the hook for one commit with `git commit --no-verify` (use sparingly).'),
  );
}

function buildHookScript(threshold: number): string {
  return [
    '#!/bin/sh',
    '# Installed by `projscan install-hook` (1.6+).',
    '# Runs projscan ci --changed-only on staged files. Fails the commit',
    '# when the project health score drops below the threshold.',
    `# Threshold: ${threshold}/100.`,
    '',
    'set -e',
    `npx projscan ci --changed-only --min-score ${threshold}`,
    '',
  ].join('\n');
}

function prefixIndent(text: string, indent: string): string {
  return text
    .split('\n')
    .map((l) => indent + l)
    .join('\n');
}
