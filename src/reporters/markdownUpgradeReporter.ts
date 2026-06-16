import type { UpgradePreview } from '../types.js';

export function reportUpgradeMarkdown(preview: UpgradePreview): void {
  const lines: string[] = [];
  lines.push(`# Upgrade Preview - \`${preview.name}\``);
  lines.push('');
  if (!preview.available) {
    lines.push(`_${preview.reason ?? 'unavailable'}_`);
    console.log(lines.join('\n'));
    return;
  }

  appendUpgradeMetadata(lines, preview);
  appendBreakingMarkers(lines, preview);
  appendImporters(lines, preview);
  appendChangelogExcerpt(lines, preview);
  console.log(lines.join('\n'));
}

function appendUpgradeMetadata(lines: string[], preview: UpgradePreview): void {
  lines.push(...upgradeMetadataLines(preview), '');
}

function upgradeMetadataLines(preview: UpgradePreview): string[] {
  return [
    ...(preview.ecosystem ? [`- Ecosystem: \`${preview.ecosystem}\``] : []),
    `- Declared: \`${preview.declared ?? '-'}\``,
    ...sourceLine('Declared source', preview.declaredSource, preview.declaredLine, scopeSuffix(preview)),
    `- Installed: \`${preview.installed ?? '-'}\``,
    ...sourceLine('Installed source', preview.installedSource, preview.installedLine),
    `- Drift: **${preview.drift}**`,
  ];
}

function sourceLine(label: string, source?: string, line?: number, suffix = ''): string[] {
  if (!source) return [];
  return [`- ${label}: \`${source}${line ? `:${line}` : ''}\`${suffix}`];
}

function scopeSuffix(preview: UpgradePreview): string {
  return preview.declaredScope ? ` (${preview.declaredScope})` : '';
}

function appendBreakingMarkers(lines: string[], preview: UpgradePreview): void {
  if (preview.breakingMarkers.length === 0) return;
  lines.push('## ⚠ Breaking-change markers');
  for (const m of preview.breakingMarkers) lines.push(`- ${m}`);
  lines.push('');
}

function appendImporters(lines: string[], preview: UpgradePreview): void {
  if (preview.importers.length === 0) return;
  lines.push(`## Importers (${preview.importers.length})`);
  for (const file of preview.importers) lines.push(`- \`${file}\``);
  lines.push('');
}

function appendChangelogExcerpt(lines: string[], preview: UpgradePreview): void {
  if (!preview.changelogExcerpt) return;
  lines.push('## CHANGELOG excerpt');
  lines.push('');
  lines.push('```');
  lines.push(preview.changelogExcerpt);
  lines.push('```');
}
