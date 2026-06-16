import { describe, expect, it } from 'vitest';
import type { AstImport } from '../../src/core/ast.js';
import type { CodeGraph, GraphFile } from '../../src/core/codeGraph.js';
import {
  buildPublicExportFileSet,
  type ReviewPublicSurfaceManifest,
} from '../../src/core/reviewPublicSurface.js';

describe('buildPublicExportFileSet', () => {
  it('maps declaration entrypoints to source files', () => {
    const publicFiles = buildPublicExportFileSet(
      [manifest('package.json', ['dist/index.d.ts'])],
      [],
      graph([file('src/index.ts')]),
      graph([file('src/index.ts')]),
    );

    expect(publicFiles.has('src/index.ts')).toBe(true);
  });

  it('follows value re-exports from entrypoints without following ordinary imports', () => {
    const publicFiles = buildPublicExportFileSet(
      [],
      [manifest('package.json', ['dist/index.js'])],
      graph([]),
      graph([
        file('src/index.ts', [
          importEdge('./api.js', 'reexport'),
          importEdge('./internal.js', 'static'),
        ]),
        file('src/api.ts'),
        file('src/internal.ts'),
      ]),
    );

    expect(publicFiles.has('src/index.ts')).toBe(true);
    expect(publicFiles.has('src/api.ts')).toBe(true);
    expect(publicFiles.has('src/internal.ts')).toBe(false);
  });
});

function manifest(manifestFile: string, entrypointFiles: string[]): ReviewPublicSurfaceManifest {
  return { manifestFile, entrypointFiles };
}

function graph(files: GraphFile[]): CodeGraph {
  return {
    files: new Map(files.map((entry) => [entry.relativePath, entry])),
    packageImporters: new Map(),
    localImporters: new Map(),
    symbolDefs: new Map(),
    scannedFiles: files.length,
  };
}

function file(relativePath: string, imports: AstImport[] = []): GraphFile {
  return {
    relativePath,
    imports,
    exports: [],
    callSites: [],
    lineCount: 1,
    cyclomaticComplexity: 0,
    functions: [],
    mtimeMs: 0,
    parseOk: true,
  };
}

function importEdge(source: string, kind: AstImport['kind'], typeOnly = false): AstImport {
  return {
    source,
    kind,
    specifiers: [],
    typeOnly,
    line: 1,
  };
}
