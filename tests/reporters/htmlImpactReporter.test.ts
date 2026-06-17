import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { reportImpactHtml } from '../../src/reporters/htmlImpactReporter.js';
import { reportImpactHtml as reportImpactHtmlFromHtmlReporter } from '../../src/reporters/htmlReporter.js';
import type { FileEntry, ImpactReport } from '../../src/types.js';
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

describe('reportImpactHtml', () => {
  it('is re-exported from the legacy HTML reporter boundary', () => {
    expect(reportImpactHtmlFromHtmlReporter).toBe(reportImpactHtml);

    const htmlReporterSource = readFileSync(
      new URL('../../src/reporters/htmlReporter.ts', import.meta.url),
      'utf-8',
    );
    expect(htmlReporterSource).toContain(
      "export { reportImpactHtml } from './htmlImpactReporter.js';",
    );
    expect(htmlReporterSource).not.toContain('function reportImpactHtml(');
  });

  it('renders unavailable impact reports without reachable sections', async () => {
    const out = await captureStdout(() =>
      reportImpactHtml(makeImpactReport({ available: false, reason: 'No graph available' })),
    );

    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<h1>Impact</h1>');
    expect(out).toContain('No graph available');
    expect(out).not.toContain('<h2>Reachable</h2>');
  });

  it('renders definitions and reachable files with escaped target text', async () => {
    const out = await captureStdout(() =>
      reportImpactHtml(
        makeImpactReport({
          target: { kind: 'symbol', value: 'render<Report>' },
          definitionFiles: ['src/<report>.ts'],
          reachable: [
            { file: 'src/a.ts', distance: 1 },
            { file: 'src/<b>.ts', distance: 2 },
          ],
          totalReachable: 2,
          truncated: true,
          maxDistance: 8,
        }),
      ),
    );

    expect(out).toContain('Impact: symbol <code>render&lt;Report&gt;</code>');
    expect(out).not.toContain('render<Report>');
    expect(out).toContain('<h2>Defined in</h2>');
    expect(out).toContain('src/&lt;report&gt;.ts');
    expect(out).toContain('src/a.ts');
    expect(out).toContain('src/&lt;b&gt;.ts');
    expect(out).toContain('2 file(s) reachable within distance 8 (truncated; more files exist beyond).');
  });

  it('renders the empty reachable state without a definitions section', async () => {
    const out = await captureStdout(() =>
      reportImpactHtml(makeImpactReport({ definitionFiles: [], reachable: [], totalReachable: 0 })),
    );

    expect(out).toContain('No reachable files.');
    expect(out).not.toContain('<h2>Defined in</h2>');
  });

  it('keeps the impact HTML entrypoint a small section orchestrator', async () => {
    const inspection = await inspectRepoSourceFile('src/reporters/htmlImpactReporter.ts');
    const renderer = inspection.functions?.find((fn) => fn.name === 'reportImpactHtml');

    expect(renderer).toBeDefined();
    expect(renderer!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });
});

function makeImpactReport(overrides: Partial<ImpactReport> = {}): ImpactReport {
  return {
    available: true,
    target: { kind: 'file', value: 'src/x.ts' },
    definitionFiles: [],
    directCallers: [],
    reachable: [
      { file: 'src/a.ts', distance: 1 },
      { file: 'src/b.ts', distance: 2 },
    ],
    totalReachable: 2,
    truncated: false,
    maxDistance: 10,
    ...overrides,
  };
}
