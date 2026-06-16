import { expect, test } from 'vitest';
import type { IssueLocation, IssueSeverity } from '../../src/types/common.js';
import type { Fix, FixResult, FixSuggestion, IssueExplanation } from '../../src/types/fixes.js';
import type {
  Fix as BarrelFix,
  FixResult as BarrelFixResult,
  FixSuggestion as BarrelFixSuggestion,
  IssueExplanation as BarrelIssueExplanation,
} from '../../src/types.js';

const severity: IssueSeverity = 'warning';
const location: IssueLocation = {
  file: 'src/index.ts',
  line: 12,
  column: 3,
  endLine: 12,
  endColumn: 15,
};

const fixSuggestion: FixSuggestion = {
  issueId: 'example-warning',
  severity,
  category: 'test',
  headline: 'Example warning',
  why: 'Compile-check the public fix suggestion shape.',
  where: [location],
  instruction: 'Keep the public type surface compatible.',
  suggestedTest: 'npm run typecheck',
  relatedFiles: ['src/types.ts'],
  references: ['docs/GUIDE.md'],
};

const issueExplanation: IssueExplanation = {
  issueId: fixSuggestion.issueId,
  title: 'Example warning',
  severity,
  category: fixSuggestion.category,
  headline: fixSuggestion.headline,
  excerpt: {
    file: location.file,
    startLine: 10,
    endLine: 12,
    lines: ['const value = 1;'],
  },
  relatedIssues: [{ id: 'related-warning', title: 'Related warning' }],
  similarFixes: [{ sha: 'abc1234', subject: 'fix: address warning', date: '2026-06-16' }],
  fix: fixSuggestion,
};

const fix: Fix = {
  id: 'example-fix',
  title: 'Example fix',
  description: 'Compile-check the public fix shape.',
  issueId: fixSuggestion.issueId,
  apply: async (_rootPath: string) => {},
};

const fixResult: FixResult = {
  fix,
  success: true,
};

const failedFixResult: FixResult = {
  fix,
  success: false,
  error: 'compile-check failure shape',
};

const barrelFixSuggestion: BarrelFixSuggestion = fixSuggestion;
const barrelIssueExplanation: BarrelIssueExplanation = issueExplanation;
const barrelFix: BarrelFix = {
  id: fix.id,
  title: fix.title,
  description: fix.description,
  issueId: fix.issueId,
  apply: fix.apply,
};
const barrelFixResult: BarrelFixResult = {
  fix: barrelFix,
  success: true,
};
const barrelFailedFixResult: BarrelFixResult = {
  fix: barrelFix,
  success: false,
  error: failedFixResult.error,
};

void [
  barrelFixSuggestion,
  barrelIssueExplanation,
  barrelFix,
  barrelFixResult,
  barrelFailedFixResult,
];

test('fix public types compile from the module and legacy barrel', () => {
  expect(barrelIssueExplanation).toBe(issueExplanation);
});
