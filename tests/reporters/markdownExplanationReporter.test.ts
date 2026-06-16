import { describe, it, expect } from 'vitest';
import { reportExplanationMarkdown } from '../../src/reporters/markdownExplanationReporter.js';
import { reportExplanationMarkdown as reportExplanationMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeExplanation } from './fixtures.js';

describe('markdownExplanationReporter', () => {
  it('preserves the markdownReporter re-export for existing callers', () => {
    expect(reportExplanationMarkdownFromMarkdownReporter).toBe(reportExplanationMarkdown);
  });

  it('renders purpose, line count, dependencies, exports, and potential issues', async () => {
    const explanation = makeExplanation();
    explanation.potentialIssues = ['high complexity'];

    const out = await captureStdout(() => reportExplanationMarkdown(explanation));

    expect(out).toContain('# File: src/index.ts');
    expect(out).toContain('**Purpose:** Entry point');
    expect(out).toContain('**Lines:** 42');
    expect(out).toContain('## Dependencies');
    expect(out).toContain('`react`');
    expect(out).toContain('## Exports');
    expect(out).toContain('`App` (function)');
    expect(out).toContain('## Potential Issues');
    expect(out).toContain('- ⚠️ high complexity');
  });

  it('omits optional sections when no details are present', async () => {
    const out = await captureStdout(() =>
      reportExplanationMarkdown({
        ...makeExplanation(),
        imports: [],
        exports: [],
        potentialIssues: [],
      }),
    );

    expect(out).not.toContain('## Dependencies');
    expect(out).not.toContain('## Exports');
    expect(out).not.toContain('## Potential Issues');
  });
});
