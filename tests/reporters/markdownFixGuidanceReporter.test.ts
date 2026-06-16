import { describe, expect, it } from 'vitest';
import {
  reportExplainIssueMarkdown,
  reportFixSuggestMarkdown,
} from '../../src/reporters/markdownFixGuidanceReporter.js';
import {
  reportExplainIssueMarkdown as reportExplainIssueMarkdownFromMarkdownReporter,
  reportFixSuggestMarkdown as reportFixSuggestMarkdownFromMarkdownReporter,
} from '../../src/reporters/markdownReporter.js';
import type { FixSuggestion, IssueExplanation } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

describe('markdownFixGuidanceReporter', () => {
  it('is re-exported from markdownReporter to preserve public reporter APIs', () => {
    expect(reportFixSuggestMarkdownFromMarkdownReporter).toBe(reportFixSuggestMarkdown);
    expect(reportExplainIssueMarkdownFromMarkdownReporter).toBe(reportExplainIssueMarkdown);
  });

  it('prints unavailable fix suggestions', async () => {
    const out = await captureStdout(() =>
      reportFixSuggestMarkdown({ matched: false, reason: 'No template matched this issue.' }),
    );

    expect(out).toContain('# Fix Suggestion');
    expect(out).toContain('> No template matched this issue.');
  });

  it('prints matched synthetic fix suggestions with markdown guidance sections', async () => {
    const out = await captureStdout(() =>
      reportFixSuggestMarkdown({
        matched: true,
        synthetic: true,
        fix: fixSuggestion(),
      }),
    );

    expect(out).toContain('# Fix Suggestion');
    expect(out).toContain('**Split the large reporter**');
    expect(out).toContain(
      '_severity: warning · category: maintainability · issue: `large-file` (synthetic)_',
    );
    expect(out).toContain('## Why');
    expect(out).toContain('Large reporter files are hard for agents and reviewers to localize');
    expect(out).toContain('## Where');
    expect(out).toContain('`src/reporters/markdownReporter.ts:42`');
    expect(out).toContain('`src/reporters/jsonReporter.ts`');
    expect(out).toContain('## Action');
    expect(out).toContain('Move the cohesive rendering block into a dedicated module');
    expect(out).toContain('## Verify');
    expect(out).toContain('npm run test -- tests/reporters/markdownFixGuidanceReporter.test.ts');
    expect(out).toContain('## Related files');
    expect(out).toContain('`src/reporters/consoleReporter.ts`');
  });

  it('prints issue explanations with excerpts, related issues, similar fixes, and suggested action', async () => {
    const out = await captureStdout(() => reportExplainIssueMarkdown(issueExplanation()));

    expect(out).toContain('# Issue: Large file');
    expect(out).toContain('_severity: warning · category: maintainability · id: `large-file`_');
    expect(out).toContain('**Reporter has too many responsibilities**');
    expect(out).toContain('## Code (`src/reporters/markdownReporter.ts` L40-42)');
    expect(out).toContain('export function reportA() {}');
    expect(out).toContain('## Related issues in the same area');
    expect(out).toContain('`similar-hotspot`: Similar reporter hotspot');
    expect(out).toContain('## Past commits referencing this rule');
    expect(out).toContain('abcdef1 (2026-06-01) Extract reporter helper');
    expect(out).toContain('## Suggested action');
    expect(out).toContain('Move the cohesive rendering block into a dedicated module');
    expect(out).toContain(
      '**Verify:** npm run test -- tests/reporters/markdownFixGuidanceReporter.test.ts',
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
      { file: 'src/reporters/markdownReporter.ts', line: 42 },
      { file: 'src/reporters/jsonReporter.ts' },
    ],
    instruction:
      'Move the cohesive rendering block into a dedicated module and keep the existing named export available from the original reporter module.',
    suggestedTest: 'npm run test -- tests/reporters/markdownFixGuidanceReporter.test.ts',
    relatedFiles: ['src/reporters/consoleReporter.ts'],
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
      file: 'src/reporters/markdownReporter.ts',
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
