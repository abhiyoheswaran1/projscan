import { describe, expect, it } from 'vitest';
import { reportAnalysis } from '../../src/reporters/consoleAnalysisReporter.js';
import { reportAnalysis as reportAnalysisFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { AnalysisReport } from '../../src/types.js';
import { captureStdout, makeAnalysisReport, makeIssue, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

function analysis(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return makeAnalysisReport(overrides);
}

describe('consoleAnalysisReporter', () => {
  it('renders project metadata and dependency summary', async () => {
    const out = await capturePlain(() => reportAnalysis(analysis()));

    expect(out).toContain('ProjScan Project Report');
    expect(out).toContain('Project');
    expect(out).toContain('Name:          test-project');
    expect(out).toContain('Language:      TypeScript');
    expect(out).toContain('Frameworks:    React');
    expect(out).toContain('Pkg Manager:   npm');
    expect(out).toContain('Dependencies:  5 prod, 3 dev');
    expect(out).toContain('Files:         42');
    expect(out).toContain('Directories:   7');
    expect(out).toContain('Scan Time:     123ms');
  });

  it('omits optional framework, package-manager, and dependency lines when absent', async () => {
    const out = await capturePlain(() =>
      reportAnalysis(
        analysis({
          frameworks: { frameworks: [], buildTools: [], packageManager: 'unknown' },
          dependencies: null,
          issues: [],
        }),
      ),
    );

    expect(out).not.toContain('Frameworks:');
    expect(out).not.toContain('Pkg Manager:');
    expect(out).not.toContain('Dependencies:');
  });

  it('sorts languages by file count and renders only the first eight', async () => {
    const out = await capturePlain(() =>
      reportAnalysis(
        analysis({
          languages: {
            primary: 'Lang10',
            languages: Object.fromEntries(
              Array.from({ length: 10 }, (_, index) => {
                const rank = index + 1;
                const fileCount = 11 - rank;
                return [
                  `Lang${rank}`,
                  {
                    name: `Lang${rank}`,
                    fileCount,
                    percentage: fileCount * 5,
                    extensions: [`.l${rank}`],
                  },
                ];
              }),
            ),
          },
          issues: [],
        }),
      ),
    );

    expect(out).toContain('Languages');
    expect(out).toContain('Lang1 (10 files)');
    expect(out).toContain('Lang8 (3 files)');
    expect(out).not.toContain('Lang9 (2 files)');
    expect(out).not.toContain('Lang10 (1 files)');
  });

  it('renders at most twelve top-level structure rows', async () => {
    const out = await capturePlain(() =>
      reportAnalysis(
        analysis({
          scan: {
            ...analysis().scan,
            directoryTree: {
              ...analysis().scan.directoryTree,
              children: Array.from({ length: 14 }, (_, index) => ({
                name: `dir-${String(index + 1).padStart(2, '0')}`,
                path: `/proj/dir-${String(index + 1).padStart(2, '0')}`,
                children: [],
                fileCount: 0,
                totalFileCount: index + 1,
              })),
            },
          },
          issues: [],
        }),
      ),
    );

    expect(out).toContain('Structure');
    expect(out).toContain('dir-01/');
    expect(out).toContain('dir-12/');
    expect(out).not.toContain('dir-13/');
    expect(out).not.toContain('dir-14/');
  });

  it('renders issue rows and fixable suggestions', async () => {
    const out = await capturePlain(() =>
      reportAnalysis(
        analysis({
          issues: [
            makeIssue({
              id: 'warn',
              title: 'Warning issue',
              description: 'Review warning.',
              fixAvailable: false,
            }),
            makeIssue({
              id: 'fix',
              title: 'Fixable issue',
              description: 'Apply generated fix.',
              severity: 'error',
              fixAvailable: true,
            }),
          ],
        }),
      ),
    );

    expect(out).toContain('Issues');
    expect(out).toContain('Warning issue');
    expect(out).toContain('Fixable issue');
    expect(out).toContain('Suggestions');
    expect(out).toContain('Apply generated fix.');
    expect(out).toContain('Run projscan fix to auto-fix these issues.');
  });

  it('preserves the consoleReporter re-export', async () => {
    const out = await capturePlain(() => reportAnalysisFromConsoleReporter(analysis()));

    expect(out).toContain('ProjScan Project Report');
    expect(out).toContain('test-project');
  });
});
