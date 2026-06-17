import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { reportReviewHtml } from '../../src/reporters/htmlReviewReporter.js';
import { reportReviewHtml as reportReviewHtmlFromHtmlReporter } from '../../src/reporters/htmlReporter.js';
import type { FileEntry } from '../../src/types.js';
import { captureStdout, makeReviewReport } from './fixtures.js';

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

describe('reportReviewHtml', () => {
  it('is re-exported from the legacy HTML reporter boundary', () => {
    expect(reportReviewHtmlFromHtmlReporter).toBe(reportReviewHtml);

    const htmlReporterSource = readFileSync(
      new URL('../../src/reporters/htmlReporter.ts', import.meta.url),
      'utf-8',
    );
    expect(htmlReporterSource).toContain(
      "export { reportReviewHtml } from './htmlReviewReporter.js';",
    );
    expect(htmlReporterSource).not.toContain('function reportReviewHtml(');
  });

  it('renders unavailable review reports without other review sections', async () => {
    const out = await captureStdout(() =>
      reportReviewHtml(
        makeReviewReport({
          available: false,
          reason: 'base ref missing',
        }),
      ),
    );

    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<h1>PR Review</h1>');
    expect(out).toContain('base ref missing');
    expect(out).not.toContain('<h2>Changed files</h2>');
  });

  it('renders verdict, changed files, cycles, risky functions, and dependency changes', async () => {
    const out = await captureStdout(() => reportReviewHtml(makeReviewReport()));

    expect(out).toContain('PR Review');
    expect(out).toContain('BLOCK');
    expect(out).toContain('Maximum changed-file risk score is 91.2.');
    expect(out).toContain('<h2>Changed files</h2>');
    expect(out).toContain('<code>src/core/review.ts</code>');
    expect(out).toContain('+5');
    expect(out).toContain('New / expanded cycles');
    expect(out).toContain('Risky functions');
    expect(out).toContain('Dependency changes');
    expect(out).toContain('agentloopkit');
  });

  it('renders all review verdict labels', async () => {
    await expect(
      captureStdout(() => reportReviewHtml(makeReviewReport({ verdict: 'block' }))),
    ).resolves.toContain('BLOCK');
    await expect(
      captureStdout(() => reportReviewHtml(makeReviewReport({ verdict: 'review' }))),
    ).resolves.toContain('REVIEW');
    await expect(
      captureStdout(() => reportReviewHtml(makeReviewReport({ verdict: 'ok' }))),
    ).resolves.toContain('OK');
  });

  it('keeps the review HTML entrypoint a small section orchestrator', async () => {
    const inspection = await inspectRepoSourceFile('src/reporters/htmlReviewReporter.ts');
    const renderer = inspection.functions?.find((fn) => fn.name === 'reportReviewHtml');

    expect(renderer).toBeDefined();
    expect(renderer!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });
});
