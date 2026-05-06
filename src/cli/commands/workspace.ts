import chalk from 'chalk';

import { program, getRootPath, getFormat, setupLogLevel, maybeCompactBanner } from '../_shared.js';
import {
  addRepo,
  loadOrCreateWorkspace,
  loadWorkspace,
  removeRepo,
  saveWorkspace,
  type Workspace,
} from '../../core/workspace.js';

/**
 * `projscan workspace` (1.6+) — register and inspect cross-repo
 * sibling repos. Distinct from `projscan workspaces` (plural) which
 * lists intra-repo monorepo packages (npm/yarn/pnpm/Lerna/Nx).
 *
 *   projscan workspace                  — list registered repos (default)
 *   projscan workspace add <path> [--name <n>]
 *   projscan workspace remove <path|name>
 *   projscan workspace list
 */
export function registerWorkspace(): void {
  const cmd = program
    .command('workspace')
    .description('Register cross-repo sibling repos for multi-repo intelligence (1.6+)')
    .action(async () => {
      await runList();
    });

  cmd
    .command('add <path>')
    .description('Register a sibling repo at the given path')
    .option('--name <name>', 'human-readable name (defaults to basename of path)')
    .action(async (repoPath: string, opts: { name?: string }) => {
      await runAdd(repoPath, opts.name);
    });

  cmd
    .command('remove <pathOrName>')
    .description('Unregister a sibling repo by path or name')
    .action(async (pathOrName: string) => {
      await runRemove(pathOrName);
    });

  cmd
    .command('list')
    .description('List registered sibling repos')
    .action(async () => {
      await runList();
    });
}

async function runList(): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  const format = getFormat();
  try {
    const w = await loadWorkspace(rootPath);
    if (format === 'json') {
      console.log(JSON.stringify({ workspace: w }, null, 2));
      return;
    }
    printList(w);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runAdd(repoPath: string, name?: string): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  try {
    const w = await loadOrCreateWorkspace(rootPath);
    const entry = addRepo(w, repoPath, name);
    await saveWorkspace(rootPath, w);
    console.log(chalk.green(`✓ Registered "${entry.name}" at ${entry.path}`));
    console.log(chalk.dim(`  ${w.repos.length} repo${w.repos.length === 1 ? '' : 's'} in workspace.`));
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function runRemove(pathOrName: string): Promise<void> {
  setupLogLevel();
  maybeCompactBanner();
  const rootPath = getRootPath();
  try {
    const w = await loadWorkspace(rootPath);
    if (!w) {
      console.log(chalk.dim('No workspace registered yet.'));
      return;
    }
    const removed = removeRepo(w, pathOrName);
    if (!removed) {
      console.log(chalk.dim(`No repo matching "${pathOrName}" — nothing to remove.`));
      return;
    }
    await saveWorkspace(rootPath, w);
    console.log(chalk.green(`✓ Unregistered "${removed.name}" (${removed.path})`));
    console.log(chalk.dim(`  ${w.repos.length} repo${w.repos.length === 1 ? '' : 's'} remaining.`));
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function printList(w: Workspace | null): void {
  console.log('');
  console.log(chalk.bold('Cross-repo workspace'));
  console.log(chalk.dim('────────────────────────────────────────'));
  if (!w || w.repos.length === 0) {
    console.log(chalk.dim('  No sibling repos registered yet.'));
    console.log('');
    console.log(chalk.dim('  Tip: run `projscan workspace add <path>` to register a sibling repo.'));
    return;
  }
  for (const r of w.repos) {
    console.log(`  ${chalk.cyan('◆')} ${chalk.bold(r.name)}  ${chalk.dim(r.path)}`);
  }
  console.log('');
  console.log(
    chalk.dim(
      `  ${w.repos.length} repo${w.repos.length === 1 ? '' : 's'} registered. Use cross-repo tools: projscan_workspace_graph, projscan impact --cross-repo.`,
    ),
  );
}
