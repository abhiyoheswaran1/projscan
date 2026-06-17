import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
