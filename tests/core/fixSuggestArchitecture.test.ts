import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

describe('fix suggest maintainability', () => {
  it('keeps preview headline routing out of the fix template registry', () => {
    const fixSuggestSource = fs.readFileSync('src/core/fixSuggest.ts', 'utf8');
    expect(fixSuggestSource).not.toContain('function staticHeadlineFor');
    expect(fixSuggestSource).not.toContain('function parseDepName');
    expect(fixSuggestSource).toContain("export { previewSuggestionForIssue } from './fixSuggestPreview.js'");

    const previewSource = fs.readFileSync('src/core/fixSuggestPreview.ts', 'utf8');
    expect(previewSource).toContain('export function previewSuggestionForIssue');
    expect(previewSource).toContain('function staticHeadlineFor');
    expect(previewSource).not.toContain("from './fixSuggest.js'");

    const dependencyNamesSource = fs.readFileSync(
      'src/core/fixSuggestDependencyNames.ts',
      'utf8',
    );
    expect(dependencyNamesSource).toContain('export function parseDepName');
    expect(dependencyNamesSource).not.toContain("from './fixSuggest.js'");
  });

  it('keeps preview headline routing below the review high-CC threshold', async () => {
    const previewInspection = await inspectRepoSourceFile('src/core/fixSuggestPreview.ts');
    const staticHeadlineFor = previewInspection.functions?.find(
      (fn) => fn.name === 'staticHeadlineFor',
    );

    expect(staticHeadlineFor).toBeDefined();
    expect(staticHeadlineFor!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });
});

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const abs = path.join(root, rel);
  const stat = fs.statSync(abs);
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
