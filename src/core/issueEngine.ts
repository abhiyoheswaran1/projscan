import type { FileEntry, Issue } from '../types.js';
import { check as eslintCheck } from '../analyzers/eslintCheck.js';
import { check as prettierCheck } from '../analyzers/prettierCheck.js';
import { check as testCheck } from '../analyzers/testCheck.js';
import { check as architectureCheck } from '../analyzers/architectureCheck.js';
import { check as dependencyRiskCheck } from '../analyzers/dependencyRiskCheck.js';
import { check as securityCheck } from '../analyzers/securityCheck.js';
import { check as unusedDependencyCheck } from '../analyzers/unusedDependencyCheck.js';
import { check as deadCodeCheck } from '../analyzers/deadCodeCheck.js';
import { check as cycleCheck } from '../analyzers/cycleCheck.js';
import { check as crossPackageImportCheck } from '../analyzers/crossPackageImportCheck.js';
import { previewSuggestionForIssue } from './fixSuggest.js';
import { check as pythonTestCheck } from '../analyzers/pythonTestCheck.js';
import { check as pythonLinterCheck } from '../analyzers/pythonLinterCheck.js';
import { check as pythonDependencyRiskCheck } from '../analyzers/pythonDependencyRiskCheck.js';
import { check as pythonUnusedDependencyCheck } from '../analyzers/pythonUnusedDependencyCheck.js';
import { loadMemory, recordRun, saveMemory } from './memory.js';

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
  // 0.13.0: lift Tarjan-detected import cycles into doctor's issue list.
  // Builds the graph via the cache, so repeated runs in a session amortize.
  cycleCheck,
  // 0.14.0: cross-package import policy. No-op unless the user configured
  // `monorepo.importPolicy` in .projscanrc and the repo is a monorepo.
  crossPackageImportCheck,
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

  // 0.14.0: attach a one-line `suggestedAction` to each issue when the
  // fix-suggest registry has a template. Cheap (synchronous projection,
  // no IO); agents calling projscan_doctor see actionable hints inline
  // and can call projscan_fix_suggest for the full structured prompt.
  for (const issue of issues) {
    const preview = previewSuggestionForIssue(issue);
    if (preview) issue.suggestedAction = preview;
  }

  // 1.5.0: Project Memory. Record this run's issue ids so projscan can
  // surface "stable across N runs" suggestions on future invocations.
  // Best-effort: any disk failure here is swallowed and does not affect
  // the returned issues. The user-visible output is unchanged at this
  // layer; the memory is consumed by the projscan_memory tool / CLI.
  void recordRunInMemory(rootPath, issues);

  return issues;
}

/**
 * 1.5.0 — fire-and-forget memory recording. Loads the on-disk memory,
 * folds in this run's rule ids (and any rule ids the user has
 * suppressed via .projscanrc disableRules), and persists. Errors are
 * swallowed; the analyzer pipeline never fails because of memory.
 */
async function recordRunInMemory(rootPath: string, issues: Issue[]): Promise<void> {
  try {
    const memory = await loadMemory(rootPath);
    const ids = issues.map((i) => i.id).filter((id): id is string => typeof id === 'string');
    recordRun(memory, ids);
    await saveMemory(rootPath, memory);
  } catch {
    // best-effort
  }
}
