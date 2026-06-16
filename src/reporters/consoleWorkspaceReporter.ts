import chalk from 'chalk';
import type { WorkspaceInfo } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportWorkspaces(info: WorkspaceInfo): void {
  console.log(header('Workspaces'));

  if (info.kind === 'none') {
    console.log(`\n  ${chalk.dim('Single-package repo (no monorepo workspaces detected).')}\n`);
    if (info.packages.length === 1) {
      const p = info.packages[0];
      console.log(`  ${chalk.bold(p.name)} ${chalk.dim(p.version ?? '')}\n`);
    }
    return;
  }

  console.log(
    chalk.dim(
      `\n  Kind: ${info.kind} · Source: ${info.source ?? '?'} · ${info.packages.length} package(s)\n`,
    ),
  );
  for (const p of info.packages) {
    const tag = p.isRoot ? chalk.dim('(root)') : '';
    const ver = p.version ? chalk.dim(` v${p.version}`) : '';
    console.log(`  ${chalk.bold(p.name)}${ver}  ${chalk.cyan(p.relativePath || '.')} ${tag}`);
  }
  console.log('');
}
