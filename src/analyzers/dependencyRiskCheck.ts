import { analyzeDependencies } from '../core/dependencyAnalyzer.js';
import type { FileEntry, Issue } from '../types.js';

export async function check(rootPath: string, _files: FileEntry[]): Promise<Issue[]> {
  const report = await analyzeDependencies(rootPath);
  if (!report) return [];

  return report.risks.map((risk) => ({
    id: `dep-risk-${risk.name}`,
    title: risk.name === 'excessive-dependencies' || risk.name === 'many-dependencies' || risk.name === 'no-lockfile'
      ? risk.reason
      : `Dependency risk: ${risk.name}`,
    description: risk.reason,
    severity: risk.severity === 'high' ? 'error' as const : risk.severity === 'medium' ? 'warning' as const : 'info' as const,
    category: 'dependencies',
    fixAvailable: false,
  }));
}
