import { describe, expect, it } from 'vitest';
import { reportAnalysisMarkdown } from '../../src/reporters/markdownAnalysisReporter.js';
import { reportAnalysisMarkdown as reportAnalysisMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeAnalysisReport, makeIssue } from './fixtures.js';

describe('markdownAnalysisReporter', () => {
  it('is re-exported from markdownReporter to preserve the public reporter API', () => {
    expect(reportAnalysisMarkdownFromMarkdownReporter).toBe(reportAnalysisMarkdown);
  });

  it('renders the project table with optional frameworks and dependency summary', async () => {
    const out = await captureStdout(() => reportAnalysisMarkdown(makeAnalysisReport()));

    expect(out).toContain('# ProjScan Project Report');
    expect(out).toContain('## Project');
    expect(out).toContain('| Field | Value |');
    expect(out).toContain('| Language | TypeScript |');
    expect(out).toContain('| Frameworks | React |');
    expect(out).toContain('| Dependencies | 5 prod, 3 dev |');
    expect(out).toContain('| Files | 42 |');
    expect(out).toContain('| Scan Time | 123ms |');
  });

  it('omits optional framework, dependency, language, and issue sections when absent', async () => {
    const out = await captureStdout(() =>
      reportAnalysisMarkdown(
        makeAnalysisReport({
          frameworks: { frameworks: [], buildTools: [], packageManager: 'unknown' },
          dependencies: null,
          languages: { primary: 'Unknown', languages: {} },
          issues: [],
        }),
      ),
    );

    expect(out).not.toContain('| Frameworks |');
    expect(out).not.toContain('| Dependencies |');
    expect(out).not.toContain('## Languages');
    expect(out).not.toContain('## Issues');
  });

  it('sorts language rows by file count and renders the first ten', async () => {
    const languageNames = [
      'Lang7',
      'Lang1',
      'Lang11',
      'Lang3',
      'Lang9',
      'Lang12',
      'Lang5',
      'Lang2',
      'Lang10',
      'Lang4',
      'Lang8',
      'Lang6',
    ];
    const out = await captureStdout(() =>
      reportAnalysisMarkdown(
        makeAnalysisReport({
          languages: {
            primary: 'Lang12',
            languages: Object.fromEntries(
              languageNames.map((name) => {
                const rank = Number(name.replace('Lang', ''));
                const fileCount = 13 - rank;
                return [
                  name,
                  { name, fileCount, percentage: fileCount * 4, extensions: [`.l${rank}`] },
                ];
              }),
            ),
          },
          issues: [],
        }),
      ),
    );

    const rows = Array.from({ length: 10 }, (_, index) => {
      const rank = index + 1;
      return `| Lang${rank} | ${13 - rank} | ${((13 - rank) * 4).toFixed(1)}% |`;
    });

    expect(out).toContain('## Languages');
    for (let index = 0; index < rows.length - 1; index++) {
      expect(out.indexOf(rows[index])).toBeLessThan(out.indexOf(rows[index + 1]));
    }
    expect(out).not.toContain('| Lang11 | 2 | 8.0% |');
    expect(out).not.toContain('| Lang12 | 1 | 4.0% |');
  });

  it('renders issue bullets with severity icons', async () => {
    const out = await captureStdout(() =>
      reportAnalysisMarkdown(
        makeAnalysisReport({
          issues: [
            makeIssue({ id: 'e', severity: 'error', title: 'Err', description: 'Error details.' }),
            makeIssue({
              id: 'w',
              severity: 'warning',
              title: 'Warn',
              description: 'Warning details.',
            }),
            makeIssue({ id: 'i', severity: 'info', title: 'Inf', description: 'Info details.' }),
          ],
        }),
      ),
    );

    expect(out).toContain('## Issues');
    expect(out).toContain('- ❌ **Err**: Error details.');
    expect(out).toContain('- ⚠️ **Warn**: Warning details.');
    expect(out).toContain('- ℹ️ **Inf**: Info details.');
  });
});
