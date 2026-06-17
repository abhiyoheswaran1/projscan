import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { reportCoverageHtml } from '../../src/reporters/htmlCoverageReporter.js';
import { reportCoverageHtml as reportCoverageHtmlFromHtmlReporter } from '../../src/reporters/htmlReporter.js';
import type { CoverageJoinedReport, FileEntry } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const abs = path.join(root, rel);
  const stat = await fs.stat(abs);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

describe('reportCoverageHtml', () => {
  it('is re-exported from the legacy HTML reporter boundary', () => {
    expect(reportCoverageHtmlFromHtmlReporter).toBe(reportCoverageHtml);

    const htmlReporterSource = readFileSync(
      new URL('../../src/reporters/htmlReporter.ts', import.meta.url),
      'utf-8',
    );
    expect(htmlReporterSource).toContain(
      "export { reportCoverageHtml } from './htmlCoverageReporter.js';",
    );
    expect(htmlReporterSource).not.toContain('function reportCoverageHtml(');
  });

  it('renders unavailable coverage reports without ranked rows', async () => {
    const out = await captureStdout(() =>
      reportCoverageHtml(makeCoverageReport({ available: false, reason: 'No coverage source found' })),
    );

    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<h1>Coverage × Risk</h1>');
    expect(out).toContain('No coverage source found');
    expect(out).not.toContain('<th class="right">Priority</th>');
  });

  it('renders ranked coverage rows with escaped paths and high-risk status', async () => {
    const out = await captureStdout(() =>
      reportCoverageHtml(
        makeCoverageReport({
          coverageSource: 'lcov',
          coverageSourceFile: 'coverage/<lcov>.info',
          entries: [
            {
              relativePath: 'src/<scary>.ts',
              riskScore: 92.4,
              churn: 30,
              lineCount: 500,
              issueCount: 5,
              coverage: 0.12,
              priority: 88.5,
              reasons: ['high churn', 'low <coverage>'],
            },
            {
              relativePath: 'src/safe.ts',
              riskScore: 10,
              churn: 1,
              lineCount: 50,
              issueCount: 0,
              coverage: 0.95,
              priority: 5,
              reasons: ['well covered'],
            },
          ],
        }),
      ),
    );

    expect(out).toContain('lcov');
    expect(out).toContain('coverage/&lt;lcov&gt;.info');
    expect(out).toContain('src/&lt;scary&gt;.ts');
    expect(out).not.toContain('src/<scary>.ts');
    expect(out).toContain('92.4');
    expect(out).toContain('12%');
    expect(out).toContain('88.5');
    expect(out).toContain('src/safe.ts');
    expect(out).toContain('95%');
    expect(out).toContain('low &lt;coverage&gt;');

    const rowsByPath: Record<string, string> = {};
    for (const row of out.split('</tr>')) {
      if (row.includes('src/&lt;scary&gt;.ts')) rowsByPath['scary'] = row;
      if (row.includes('src/safe.ts')) rowsByPath['safe'] = row;
    }
    expect(rowsByPath['scary']).toMatch(/<tr class="severity-error">/);
    expect(rowsByPath['safe']).toMatch(/<tr>/);
    expect(rowsByPath['safe']).not.toMatch(/<tr class="severity-error">/);
  });

  it('renders available empty coverage reports and null coverage cells', async () => {
    const out = await captureStdout(() =>
      reportCoverageHtml(
        makeCoverageReport({
          coverageSource: null,
          coverageSourceFile: null,
          entries: [
            {
              relativePath: 'src/x.ts',
              riskScore: 50,
              churn: 5,
              lineCount: 100,
              issueCount: 1,
              coverage: null,
              priority: 50,
              reasons: [],
            },
          ],
        }),
      ),
    );

    expect(out).toContain('no coverage source');
    expect(out).toContain('src/x.ts');
    expect(out).toMatch(/<td class="right">-<\/td>/);
  });

  it('keeps the coverage HTML entrypoint a small section orchestrator', async () => {
    const inspection = await inspectRepoSourceFile('src/reporters/htmlCoverageReporter.ts');
    const renderer = inspection.functions?.find((fn) => fn.name === 'reportCoverageHtml');

    expect(renderer).toBeDefined();
    expect(renderer!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });
});

function makeCoverageReport(overrides: Partial<CoverageJoinedReport> = {}): CoverageJoinedReport {
  return {
    available: true,
    coverageSource: 'lcov',
    coverageSourceFile: 'coverage/lcov.info',
    entries: [],
    ...overrides,
  };
}
