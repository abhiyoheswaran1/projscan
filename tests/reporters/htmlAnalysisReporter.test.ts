import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { reportAnalysisHtml } from '../../src/reporters/htmlAnalysisReporter.js';
import { reportAnalysisHtml as reportAnalysisHtmlFromHtmlReporter } from '../../src/reporters/htmlReporter.js';
import type { FileEntry } from '../../src/types.js';
import { captureStdout, makeAnalysisReport } from './fixtures.js';

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

describe('reportAnalysisHtml', () => {
  it('is re-exported from the legacy HTML reporter boundary', () => {
    expect(reportAnalysisHtmlFromHtmlReporter).toBe(reportAnalysisHtml);

    const htmlReporterSource = readFileSync(
      new URL('../../src/reporters/htmlReporter.ts', import.meta.url),
      'utf-8',
    );
    expect(htmlReporterSource).toContain(
      "export { reportAnalysisHtml } from './htmlAnalysisReporter.js';",
    );
    expect(htmlReporterSource).not.toContain('function reportAnalysisHtml(');
  });

  it('renders project summary, languages, issues, files, and report controls', async () => {
    const out = await captureStdout(() =>
      reportAnalysisHtml(makeAnalysisReport(), {
        active: true,
        scopeCount: 2,
        redactPaths: true,
        pathLabelFormat: 'redacted-path-N',
      }),
    );

    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('Project analysis: test-project');
    expect(out).toContain('Report controls');
    expect(out).toContain('scopes: 2');
    expect(out).toContain('Primary language');
    expect(out).toContain('TypeScript');
    expect(out).toContain('Issues (1)');
    expect(out).toContain('Missing README');
    expect(out).toContain('Files (42)');
  });

  it('keeps the analysis HTML entrypoint a small section orchestrator', async () => {
    const inspection = await inspectRepoSourceFile('src/reporters/htmlAnalysisReporter.ts');
    const renderer = inspection.functions?.find((fn) => fn.name === 'reportAnalysisHtml');

    expect(renderer).toBeDefined();
    expect(renderer!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });
});
