import { describe, expect, it } from 'vitest';
import {
  reportExplainIssue,
  reportFixSuggest,
} from '../../src/reporters/consoleFixGuidanceReporter.js';
import {
  reportExplainIssue as reportExplainIssueFromConsoleReporter,
  reportFixSuggest as reportFixSuggestFromConsoleReporter,
} from '../../src/reporters/consoleReporter.js';
import type { FixSuggestion, IssueExplanation } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

describe('consoleFixGuidanceReporter', () => {
  it('is re-exported from consoleReporter to preserve public reporter APIs', () => {
    expect(reportFixSuggestFromConsoleReporter).toBe(reportFixSuggest);
    expect(reportExplainIssueFromConsoleReporter).toBe(reportExplainIssue);
  });

  it('prints unavailable fix suggestions', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportFixSuggest({ matched: false, reason: 'No template matched this issue.' }),
      ),
    );

    expect(out).toContain('Fix Suggestion');
    expect(out).toContain('No template matched this issue.');
  });

  it('prints matched synthetic fix suggestions with wrapped guidance sections', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportFixSuggest({
          matched: true,
          synthetic: true,
          fix: fixSuggestion(),
        }),
      ),
    );

    expect(out).toContain('Fix Suggestion');
    expect(out).toContain('Split the large reporter');
    expect(out).toContain('warning · maintainability · large-file (synthetic)');
    expect(out).toContain('Why');
    expect(out).toContain(
      'Large reporter files are hard for agents and reviewers to localize because',
    );
    expect(out).toContain('Where');
    expect(out).toContain('src/reporters/consoleReporter.ts:42');
    expect(out).toContain('src/reporters/jsonReporter.ts');
    expect(out).toContain('Action');
    expect(out).toContain('Move the cohesive rendering block into a dedicated module and keep the');
    expect(out).toContain('Verify');
    expect(out).toContain('npm run test -- tests/reporters/consoleFixGuidanceReporter.test.ts');
    expect(out).toContain('Related files');
    expect(out).toContain('src/reporters/markdownReporter.ts');
  });

  it('prints issue explanations with excerpts, related issues, similar fixes, and suggested action', async () => {
    const out = stripAnsi(await captureStdout(() => reportExplainIssue(issueExplanation())));

    expect(out).toContain('Issue Explanation');
    expect(out).toContain('Large file (large-file)');
    expect(out).toContain('severity: warning · category: maintainability');
    expect(out).toContain('Reporter has too many responsibilities');
    expect(out).toContain('Code (src/reporters/consoleReporter.ts L40-42)');
    expect(out).toContain('40  export function reportA() {}');
    expect(out).toContain('42  export function reportC() {}');
    expect(out).toContain('Related issues in the same area:');
    expect(out).toContain('similar-hotspot: Similar reporter hotspot');
    expect(out).toContain('Past commits referencing this rule:');
    expect(out).toContain('abcdef1 (2026-06-01) Extract reporter helper');
    expect(out).toContain('Suggested action:');
    expect(out).toContain('Move the cohesive rendering block into a dedicated module and keep the');
    expect(out).toContain(
      'Verify: npm run test -- tests/reporters/consoleFixGuidanceReporter.test.ts',
    );
  });
});

function fixSuggestion(): FixSuggestion {
  return {
    issueId: 'large-file',
    severity: 'warning',
    category: 'maintainability',
    headline: 'Split the large reporter',
    why: 'Large reporter files are hard for agents and reviewers to localize because unrelated output modes share the same edit surface and review context.',
    where: [
      { file: 'src/reporters/consoleReporter.ts', line: 42 },
      { file: 'src/reporters/jsonReporter.ts' },
    ],
    instruction:
      'Move the cohesive rendering block into a dedicated module and keep the existing named export available from the original reporter module.',
    suggestedTest: 'npm run test -- tests/reporters/consoleFixGuidanceReporter.test.ts',
    relatedFiles: ['src/reporters/markdownReporter.ts'],
  };
}

function issueExplanation(): IssueExplanation {
  return {
    issueId: 'large-file',
    title: 'Large file',
    severity: 'warning',
    category: 'maintainability',
    headline: 'Reporter has too many responsibilities',
    excerpt: {
      file: 'src/reporters/consoleReporter.ts',
      startLine: 40,
      endLine: 42,
      lines: [
        'export function reportA() {}',
        'export function reportB() {}',
        'export function reportC() {}',
      ],
    },
    relatedIssues: [{ id: 'similar-hotspot', title: 'Similar reporter hotspot' }],
    similarFixes: [
      {
        sha: 'abcdef1234567890',
        date: '2026-06-01',
        subject: 'Extract reporter helper',
      },
    ],
    fix: fixSuggestion(),
  };
}
