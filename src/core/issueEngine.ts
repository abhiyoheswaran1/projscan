import type { FileEntry, Issue } from '../types.js';
import { check as eslintCheck } from '../analyzers/eslintCheck.js';
import { check as prettierCheck } from '../analyzers/prettierCheck.js';
import { check as testCheck } from '../analyzers/testCheck.js';
import { check as architectureCheck } from '../analyzers/architectureCheck.js';
import { check as dependencyRiskCheck } from '../analyzers/dependencyRiskCheck.js';

type Checker = (rootPath: string, files: FileEntry[]) => Promise<Issue[]>;

const checkers: Checker[] = [
  eslintCheck,
  prettierCheck,
  testCheck,
  architectureCheck,
  dependencyRiskCheck,
];

export async function collectIssues(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const results = await Promise.all(checkers.map((check) => check(rootPath, files)));
  const issues = results.flat();

  // Sort by severity: error > warning > info
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return issues;
}
