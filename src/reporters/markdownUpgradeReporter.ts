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
  lines.push(`- Declared: \`${preview.declared ?? '-'}\``);
  lines.push(`- Installed: \`${preview.installed ?? '-'}\``);
  lines.push(`- Drift: **${preview.drift}**`);
  lines.push('');
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
