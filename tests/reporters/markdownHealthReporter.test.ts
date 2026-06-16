import { describe, it, expect } from 'vitest';
import {
  reportCiMarkdown,
  reportHealthMarkdown,
} from '../../src/reporters/markdownHealthReporter.js';
import {
  reportCiMarkdown as reportCiMarkdownFromMarkdownReporter,
  reportHealthMarkdown as reportHealthMarkdownFromMarkdownReporter,
} from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeIssue } from './fixtures.js';

describe('markdownHealthReporter', () => {
  it('preserves markdownReporter re-exports for existing callers', () => {
    expect(reportHealthMarkdownFromMarkdownReporter).toBe(reportHealthMarkdown);
    expect(reportCiMarkdownFromMarkdownReporter).toBe(reportCiMarkdown);
  });

  it('renders health score, badge, issue actions, and report controls', async () => {
    const out = await captureStdout(() =>
      reportHealthMarkdown(
        [
          makeIssue({
            id: 'fixable',
            severity: 'error',
            title: 'Fixable',
            suggestedAction: { summary: 'Apply the fix', command: 'projscan fix-suggest fixable' },
          }),
        ],
        { active: true, scopeCount: 1, redactPaths: true, pathLabelFormat: 'redacted-path-N' },
      ),
    );

    expect(out).toContain('# Project Health Report');
    expect(out).toContain('> Report controls: active; scopes: 1; path redaction: redacted-path-N.');
    expect(out).toMatch(/\*\*Health Score: [A-F] \(\d+\/100\)\*\*/);
    expect(out).toMatch(/!\[.*\]\(.*\)/);
    expect(out).toContain('❌ **Fixable**');
    expect(out).toContain('**Action:** Apply the fix _(`projscan fix-suggest fixable`)_');
  });

  it('renders CI pass and fail tables with optional issues', async () => {
    const pass = await captureStdout(() => reportCiMarkdown([], 50));
    const fail = await captureStdout(() =>
      reportCiMarkdown([makeIssue({ severity: 'error', title: 'Fatal' })], 100),
    );

    expect(pass).toContain('# Projscan CI - PASS');
    expect(pass).toContain('| Result | ✅ Pass |');
    expect(fail).toContain('# Projscan CI - FAIL');
    expect(fail).toContain('| Result | ❌ Fail |');
    expect(fail).toContain('## Issues');
    expect(fail).toContain('❌ **Fatal**');
  });
});
