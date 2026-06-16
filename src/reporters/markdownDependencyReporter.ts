import type { DependencyReport } from '../types.js';

export function reportDependenciesMarkdown(report: DependencyReport): void {
  const lines: string[] = ['# Dependency Report', ''];
  lines.push(`- Production: **${report.totalDependencies}** packages`);
  lines.push(`- Development: **${report.totalDevDependencies}** packages`);

  if (report.licenses) {
    lines.push('');
    lines.push('## License Summary');
    lines.push(`- Known: **${report.licenses.packages.length - report.licenses.unknown.length}**`);
    lines.push(`- Unknown: **${report.licenses.unknown.length}**`);
    lines.push(`- Copyleft: **${report.licenses.copyleft.length}**`);
    for (const [license, count] of Object.entries(report.licenses.byLicense)) {
      lines.push(`- ${license}: ${count}`);
    }
  }

  if (report.sizes && report.sizes.largest.length > 0) {
    lines.push('');
    lines.push('## Installed Package Sizes');
    lines.push(`- Total: **${report.sizes.formattedTotal}**`);
    lines.push(`- Missing: **${report.sizes.missing.length}**`);
    for (const entry of report.sizes.largest) {
      lines.push(`- \`${entry.name}\` ${entry.version}: ${entry.formatted} (${entry.scope})`);
    }
  }

  if (report.risks.length > 0) {
    lines.push('');
    lines.push('## Risks');
    for (const risk of report.risks) {
      lines.push(`- **${risk.name}**: ${risk.reason} (${risk.severity})`);
    }
  }

  console.log(lines.join('\n'));
}
