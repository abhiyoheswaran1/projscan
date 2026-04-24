import type { FileEntry, Issue } from '../types.js';
import { check as eslintCheck } from '../analyzers/eslintCheck.js';
import { check as prettierCheck } from '../analyzers/prettierCheck.js';
import { check as testCheck } from '../analyzers/testCheck.js';
import { check as architectureCheck } from '../analyzers/architectureCheck.js';
import { check as dependencyRiskCheck } from '../analyzers/dependencyRiskCheck.js';
import { check as securityCheck } from '../analyzers/securityCheck.js';
import { check as unusedDependencyCheck } from '../analyzers/unusedDependencyCheck.js';
import { check as deadCodeCheck } from '../analyzers/deadCodeCheck.js';
import { check as pythonTestCheck } from '../analyzers/pythonTestCheck.js';
import { check as pythonLinterCheck } from '../analyzers/pythonLinterCheck.js';
import { check as pythonDependencyRiskCheck } from '../analyzers/pythonDependencyRiskCheck.js';
import { check as pythonUnusedDependencyCheck } from '../analyzers/pythonUnusedDependencyCheck.js';

type Checker = (rootPath: string, files: FileEntry[]) => Promise<Issue[]>;

const checkers: Checker[] = [
  eslintCheck,
  prettierCheck,
  testCheck,
  architectureCheck,
  dependencyRiskCheck,
  securityCheck,
  unusedDependencyCheck,
  deadCodeCheck,
  // Python analyzers - each early-exits on zero .py files so JS/TS repos
  // see zero new issues.
  pythonTestCheck,
  pythonLinterCheck,
  pythonDependencyRiskCheck,
  pythonUnusedDependencyCheck,
];

export async function collectIssues(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const results = await Promise.all(checkers.map((check) => check(rootPath, files)));
  const issues = results.flat();

  // Sort by severity: error > warning > info
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return issues;
}
