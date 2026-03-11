import type { Fix, Issue } from '../types.js';
import { eslintFix } from './eslintFix.js';
import { prettierFix } from './prettierFix.js';
import { testFix } from './testFix.js';
import { editorconfigFix } from './editorconfigFix.js';

const fixes: Fix[] = [eslintFix, prettierFix, testFix, editorconfigFix];

const fixMap = new Map<string, Fix>(fixes.map((f) => [f.id, f]));

export function getFixForIssue(issue: Issue): Fix | null {
  if (!issue.fixAvailable || !issue.fixId) return null;
  return fixMap.get(issue.fixId) ?? null;
}

export function getAllAvailableFixes(issues: Issue[]): Fix[] {
  const result: Fix[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    const fix = getFixForIssue(issue);
    if (fix && !seen.has(fix.id)) {
      seen.add(fix.id);
      result.push(fix);
    }
  }

  return result;
}
