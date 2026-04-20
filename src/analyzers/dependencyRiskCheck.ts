import { analyzeDependencies } from '../core/dependencyAnalyzer.js';
import { findDependencyLines } from '../utils/packageJsonLocator.js';
import type { FileEntry, Issue, IssueLocation } from '../types.js';

const PROJECT_LEVEL_RISKS = new Set([
  'excessive-dependencies',
  'many-dependencies',
  'no-lockfile',
]);

export async function check(rootPath: string, _files: FileEntry[]): Promise<Issue[]> {
  const report = await analyzeDependencies(rootPath);
  if (!report) return [];

  const locations = await findDependencyLines(rootPath);

  return report.risks.map((risk): Issue => {
    const isProjectLevel = PROJECT_LEVEL_RISKS.has(risk.name);
    const line = !isProjectLevel ? locations?.lineOfDependency.get(risk.name) : undefined;
    const issueLocations: IssueLocation[] | undefined = isProjectLevel
      ? [{ file: 'package.json' }]
      : line
        ? [{ file: 'package.json', line }]
        : [{ file: 'package.json' }];

    return {
      id: `dep-risk-${risk.name}`,
      title: isProjectLevel ? risk.reason : `Dependency risk: ${risk.name}`,
      description: risk.reason,
      severity:
        risk.severity === 'high'
          ? ('error' as const)
          : risk.severity === 'medium'
            ? ('warning' as const)
            : ('info' as const),
      category: 'dependencies',
      fixAvailable: false,
      locations: issueLocations,
    };
  });
}
