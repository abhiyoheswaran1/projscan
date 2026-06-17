import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('search index maintainability', () => {
  it('keeps tokenization and indexability helpers out of the search facade', () => {
    const searchIndexSource = fs.readFileSync('src/core/searchIndex.ts', 'utf8');
    expect(searchIndexSource).not.toContain('const STOPWORDS');
    expect(searchIndexSource).not.toContain('const TS_KEYWORDS');
    expect(searchIndexSource).not.toContain('const PY_KEYWORDS');
    expect(searchIndexSource).not.toContain('function stem');
    expect(searchIndexSource).not.toContain('function keepToken');
    expect(searchIndexSource).not.toContain('function countHits');
    expect(searchIndexSource).not.toContain('function isIndexable');
    expect(searchIndexSource).toContain("import { countHits, expandQuery, tokenize } from './searchIndexText.js'");
    expect(searchIndexSource).toContain('export { expandQuery, tokenize };');

    const textSource = fs.readFileSync('src/core/searchIndexText.ts', 'utf8');
    expect(textSource).toContain('export function tokenize');
    expect(textSource).toContain('export function expandQuery');
    expect(textSource).not.toContain("from './searchIndex.js'");

    const filesSource = fs.readFileSync('src/core/searchIndexFiles.ts', 'utf8');
    expect(filesSource).toContain('export function isSearchIndexableFile');
    expect(filesSource).not.toContain("from './searchIndex.js'");
  });
});
