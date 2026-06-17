import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { reportPrDiffHtml } from '../../src/reporters/htmlPrDiffReporter.js';
import { reportPrDiffHtml as reportPrDiffHtmlFromHtmlReporter } from '../../src/reporters/htmlReporter.js';
import type { FileEntry, PrDiffReport } from '../../src/types.js';
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

describe('reportPrDiffHtml', () => {
  it('is re-exported from the legacy HTML reporter boundary', () => {
    expect(reportPrDiffHtmlFromHtmlReporter).toBe(reportPrDiffHtml);

    const htmlReporterSource = readFileSync(
      new URL('../../src/reporters/htmlReporter.ts', import.meta.url),
      'utf-8',
    );
    expect(htmlReporterSource).toContain(
      "export { reportPrDiffHtml } from './htmlPrDiffReporter.js';",
    );
    expect(htmlReporterSource).not.toContain('function reportPrDiffHtml(');
  });

  it('renders unavailable PR diffs without structural sections', async () => {
    const out = await captureStdout(() =>
      reportPrDiffHtml(makePrDiff({ available: false, reason: 'base ref missing' })),
    );

    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<h1>PR Structural Diff</h1>');
    expect(out).toContain('base ref missing');
    expect(out).not.toContain('Added (');
  });

  it('renders added, removed, and modified sections with deltas', async () => {
    const out = await captureStdout(() => reportPrDiffHtml(makePrDiff()));

    expect(out).toContain('PR Structural Diff');
    expect(out).toContain('Added (1)');
    expect(out).toContain('Removed (1)');
    expect(out).toContain('Modified (1)');
    expect(out).toContain('src/new.ts');
    expect(out).toContain('src/old.ts');
    expect(out).toContain('src/edited.ts');
    expect(out).toContain('+exports');
    expect(out).toContain('foo');
    expect(out).toContain('bar');
    expect(out).toContain('ΔCC +3');
    expect(out).toContain('Δfan-in -1');
  });

  it('keeps the PR diff HTML entrypoint a small section orchestrator', async () => {
    const inspection = await inspectRepoSourceFile('src/reporters/htmlPrDiffReporter.ts');
    const renderer = inspection.functions?.find((fn) => fn.name === 'reportPrDiffHtml');

    expect(renderer).toBeDefined();
    expect(renderer!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });
});

function makePrDiff(overrides: Partial<PrDiffReport> = {}): PrDiffReport {
  return {
    available: true,
    base: { ref: 'main', resolvedSha: 'aaaaaaa' },
    head: { ref: 'HEAD', resolvedSha: 'bbbbbbb' },
    filesAdded: ['src/new.ts'],
    filesRemoved: ['src/old.ts'],
    filesModified: [
      {
        relativePath: 'src/edited.ts',
        status: 'modified',
        exportsAdded: ['foo'],
        exportsRemoved: ['bar'],
        exportsRenamed: [],
        importsAdded: [],
        importsRemoved: [],
        callsAdded: [],
        callsRemoved: [],
        cyclomaticDelta: 3,
        fanInDelta: -1,
      },
    ],
    totalFilesChanged: 3,
    ...overrides,
  };
}
