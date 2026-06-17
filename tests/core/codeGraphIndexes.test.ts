import { expect, test } from 'vitest';
import type { AstExport, AstImport } from '../../src/core/ast.js';
import { rebuildCrossFileIndexes } from '../../src/core/codeGraphIndexes.js';

test('code graph indexes local imports, package imports, and exported symbols', () => {
  const graphFiles = new Map([
    [
      'src/helper.ts',
      graphFile('src/helper.ts', [], [astExport('helper'), astExport('HelperType', 'type')]),
    ],
    [
      'src/main.ts',
      graphFile(
        'src/main.ts',
        [astImport('./helper.js'), astImport('react/jsx-runtime'), astImport('node:fs')],
        [astExport('main')],
      ),
    ],
  ]);

  const indexes = rebuildCrossFileIndexes(graphFiles, new Map());

  expect(indexes.localImporters.get('src/helper.ts')).toEqual(new Set(['src/main.ts']));
  expect(indexes.packageImporters.get('react')).toEqual(new Set(['src/main.ts']));
  expect(indexes.packageImporters.has('node:fs')).toBe(false);
  expect(indexes.symbolDefs.get('helper')).toEqual(new Set(['src/helper.ts']));
  expect(indexes.symbolDefs.get('HelperType')).toEqual(new Set(['src/helper.ts']));
  expect(indexes.symbolDefs.get('main')).toEqual(new Set(['src/main.ts']));
});

test('code graph indexes skip unnamed exports', () => {
  const graphFiles = new Map([
    ['src/default.ts', graphFile('src/default.ts', [], [astExport(''), astExport('named')])],
  ]);

  const indexes = rebuildCrossFileIndexes(graphFiles, new Map());

  expect(indexes.symbolDefs.has('')).toBe(false);
  expect(indexes.symbolDefs.get('named')).toEqual(new Set(['src/default.ts']));
});

function graphFile(
  relativePath: string,
  imports: AstImport[] = [],
  exports: AstExport[] = [],
): { relativePath: string; imports: AstImport[]; exports: AstExport[] } {
  return { relativePath, imports, exports };
}

function astImport(source: string): AstImport {
  return {
    source,
    kind: 'static',
    specifiers: [],
    typeOnly: false,
    line: 1,
  };
}

function astExport(name: string, kind: AstExport['kind'] = 'function'): AstExport {
  return {
    name,
    kind,
    typeOnly: kind === 'type',
    line: 1,
  };
}
