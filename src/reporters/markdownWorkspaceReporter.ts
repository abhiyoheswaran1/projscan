import type { WorkspaceInfo } from '../types.js';

export function reportWorkspacesMarkdown(info: WorkspaceInfo): void {
  const lines: string[] = ['# Workspaces', ''];
  lines.push(
    `_kind: **${info.kind}**${info.source ? ` · source: ${info.source}` : ''} · ${info.packages.length} package(s)_`,
    '',
  );

  if (info.packages.length === 0) {
    lines.push('No packages detected.');
    console.log(lines.join('\n'));
    return;
  }

  appendWorkspaceRows(lines, info);
  console.log(lines.join('\n'));
}

function appendWorkspaceRows(lines: string[], info: WorkspaceInfo): void {
  lines.push('| Package | Path | Version | Root |');
  lines.push('| --- | --- | --- | :-: |');
  for (const p of info.packages) {
    lines.push(workspaceRow(p));
  }
}

function workspaceRow(packageInfo: WorkspaceInfo['packages'][number]): string {
  const path = packageInfo.relativePath || '.';
  const version = packageInfo.version ?? '-';
  const root = packageInfo.isRoot ? '✓' : '';
  return `| \`${packageInfo.name}\` | \`${path}\` | ${version} | ${root} |`;
}
