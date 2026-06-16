import type { DiffResult } from '../types.js';

export function reportDiffMarkdown(diff: DiffResult): void {
  const delta = diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : String(diff.scoreDelta);
  const arrow = diff.scoreDelta > 0 ? '↑' : diff.scoreDelta < 0 ? '↓' : '-';

  const lines: string[] = [
    '# Health Diff',
    '',
    '| Metric | Before | After | Delta |',
    '| --- | --- | --- | --- |',
    `| Score | ${diff.before.score} | ${diff.after.score} | ${delta} ${arrow} |`,
    `| Grade | ${diff.before.grade} | ${diff.after.grade} | |`,
  ];

  appendIssueSections(lines, diff);
  appendHotspotSections(lines, diff);

  console.log(lines.join('\n'));
}

function appendIssueSections(lines: string[], diff: DiffResult): void {
  if (diff.resolvedIssues.length > 0) {
    lines.push('', '## Resolved', '');
    for (const title of diff.resolvedIssues) {
      lines.push(`- ✅ ${title}`);
    }
  }

  if (diff.newIssues.length > 0) {
    lines.push('', '## New Issues', '');
    for (const title of diff.newIssues) {
      lines.push(`- ❌ ${title}`);
    }
  }
}

function appendHotspotSections(lines: string[], diff: DiffResult): void {
  if (!diff.hotspotDiff) return;

  const hd = diff.hotspotDiff;
  if (hd.rose.length > 0) appendRoseSection(lines, hd.rose);
  if (hd.appeared.length > 0) appendAppearedSection(lines, hd.appeared);
  if (hd.fell.length > 0) appendFellSection(lines, hd.fell);
}

function appendRoseSection(
  lines: string[],
  rose: NonNullable<DiffResult['hotspotDiff']>['rose'],
): void {
  lines.push('', '## Hotspots Worsening', '');
  lines.push('| File | Before | After | Δ |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const d of rose) {
    lines.push(
      `| \`${d.relativePath}\` | ${d.beforeScore?.toFixed(1)} | ${d.afterScore?.toFixed(1)} | +${d.scoreDelta.toFixed(1)} |`,
    );
  }
}

function appendAppearedSection(
  lines: string[],
  appeared: NonNullable<DiffResult['hotspotDiff']>['appeared'],
): void {
  lines.push('', '## Newly Risky Files', '');
  lines.push('| File | Score |');
  lines.push('| --- | ---: |');
  for (const d of appeared) {
    lines.push(`| \`${d.relativePath}\` | ${d.afterScore?.toFixed(1)} |`);
  }
}

function appendFellSection(
  lines: string[],
  fell: NonNullable<DiffResult['hotspotDiff']>['fell'],
): void {
  lines.push('', '## Hotspots Improving', '');
  lines.push('| File | Before | After | Δ |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const d of fell) {
    lines.push(
      `| \`${d.relativePath}\` | ${d.beforeScore?.toFixed(1)} | ${d.afterScore?.toFixed(1)} | ${d.scoreDelta.toFixed(1)} |`,
    );
  }
}
