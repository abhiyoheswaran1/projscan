import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  buildCodeGraph,
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
  toPackageName,
} from '../../src/core/codeGraph.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-graph-'));
}

async function writeFile(root: string, rel: string, content: string): Promise<FileEntry> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
  const stat = await fs.stat(abs);
  return {
    relativePath: rel.split(path.sep).join('/'),
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.dirname(rel) || '.',
  };
}

describe('toPackageName', () => {
  it('identifies bare packages', () => {
    expect(toPackageName('react')).toBe('react');
    expect(toPackageName('react/jsx-runtime')).toBe('react');
    expect(toPackageName('@scope/pkg/deep')).toBe('@scope/pkg');
  });
  it('returns null for relatives and builtins', () => {
    expect(toPackageName('./local')).toBeNull();
    expect(toPackageName('node:fs')).toBeNull();
    expect(toPackageName('fs')).toBeNull();
  });
});

describe('buildCodeGraph', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('keeps cross-file index rebuilding isolated from the graph orchestrator', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'src/core/codeGraph.ts'), 'utf-8');

    expect(source).not.toContain('function rebuildCrossFileIndexes');
    expect(source).toContain("from './codeGraphIndexes.js'");
    expect(source).toContain('rebuildCrossFileIndexes(');
  });

  it('keeps file parsing and cached-entry construction isolated from the graph orchestrator', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'src/core/codeGraph.ts'), 'utf-8');
    const parsingPath = path.join(process.cwd(), 'src/core/codeGraphParsing.ts');
    const parsingExists = await fs.access(parsingPath).then(
      () => true,
      () => false,
    );

    expect(parsingExists).toBe(true);
    if (!parsingExists) return;

    const parsing = await fs.readFile(parsingPath, 'utf-8');

    expect(source).toContain("from './codeGraphParsing.js'");
    expect(source).toContain("from './codeGraphTypes.js'");
    expect(source).toContain("import type { CodeGraph, GraphFile } from './codeGraphTypes.js';");
    expect(source).toContain('export type { CodeGraph, GraphFile };');
    expect(source).not.toContain('async function parseFileToGraphEntry');
    expect(source).not.toContain('async function processChangedPath');
    expect(source).not.toContain('async function safeAdapterParse');
    expect(source).not.toContain('function graphFileFromResult');
    expect(parsing).toContain('export async function parseFileToGraphEntry');
    expect(parsing).toContain('export async function processChangedPath');
    expect(parsing).toContain('export async function safeAdapterParse');
    expect(parsing).toContain('export function graphFileFromResult');
    expect(parsing).not.toContain("from './codeGraph.js'");
  });

  it('keeps public query helpers isolated from the graph orchestrator', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'src/core/codeGraph.ts'), 'utf-8');

    expect(source).toContain("from './codeGraphQueries.js'");
    expect(source).toContain('export {');
    expect(source).not.toContain('export function packagesUsed');
    expect(source).not.toContain('export function filesImportingPackage');
    expect(source).not.toContain('export function filesImportingFile');
    expect(source).not.toContain('export function filesDefiningSymbol');
    expect(source).not.toContain('export function importersOf');
    expect(source).not.toContain('export function exportsOf');
    expect(source).not.toContain('export function importsOf');

    const queries = await fs.readFile(
      path.join(process.cwd(), 'src/core/codeGraphQueries.ts'),
      'utf-8',
    );
    expect(queries).toContain('export function packagesUsed');
    expect(queries).toContain('export function filesImportingPackage');
    expect(queries).toContain('export function filesImportingFile');
    expect(queries).toContain('export function filesDefiningSymbol');
    expect(queries).toContain('export function importersOf');
    expect(queries).toContain('export function exportsOf');
    expect(queries).toContain('export function importsOf');
  });

  it('indexes package importers and external packages', async () => {
    const files = [
      await writeFile(tmp, 'src/a.ts', "import React from 'react';"),
      await writeFile(tmp, 'src/b.ts', "import { h } from 'react/jsx-runtime';"),
    ];
    const graph = await buildCodeGraph(tmp, files);
    expect(filesImportingPackage(graph, 'react').sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('resolves relative imports to local files', async () => {
    const files = [
      await writeFile(tmp, 'src/helper.ts', 'export const x = 1;'),
      await writeFile(tmp, 'src/main.ts', "import { x } from './helper.js';"),
    ];
    const graph = await buildCodeGraph(tmp, files);
    expect(filesImportingFile(graph, 'src/helper.ts')).toEqual(['src/main.ts']);
  });

  it('resolves barrel index files', async () => {
    const files = [
      await writeFile(tmp, 'src/utils/index.ts', "export { helper } from './helper.js';"),
      await writeFile(tmp, 'src/utils/helper.ts', 'export function helper() {}'),
      await writeFile(tmp, 'src/main.ts', "import { helper } from './utils';"),
    ];
    const graph = await buildCodeGraph(tmp, files);
    expect(filesImportingFile(graph, 'src/utils/index.ts')).toContain('src/main.ts');
  });

  it('indexes symbol definitions', async () => {
    const files = [
      await writeFile(tmp, 'src/a.ts', 'export function theOne() {}'),
      await writeFile(tmp, 'src/b.ts', 'export const other = 1;'),
    ];
    const graph = await buildCodeGraph(tmp, files);
    expect(filesDefiningSymbol(graph, 'theOne')).toEqual(['src/a.ts']);
    expect(filesDefiningSymbol(graph, 'other')).toEqual(['src/b.ts']);
    expect(filesDefiningSymbol(graph, 'nope')).toEqual([]);
  });

  it('returns exportsOf and importsOf for a file', async () => {
    const files = [
      await writeFile(tmp, 'src/a.ts', "import React from 'react';\nexport function go() {}"),
    ];
    const graph = await buildCodeGraph(tmp, files);
    expect(exportsOf(graph, 'src/a.ts')[0].name).toBe('go');
    expect(importsOf(graph, 'src/a.ts')[0].source).toBe('react');
  });

  it('expands local type-only star re-exports into exported symbols', async () => {
    const files = [
      await writeFile(
        tmp,
        'src/types.ts',
        'export interface PublicReport { ok: boolean }\nexport type PublicMode = "ready";',
      ),
      await writeFile(tmp, 'src/index.ts', "export type * from './types.js';"),
    ];
    const graph = await buildCodeGraph(tmp, files);
    const entrypointExports = exportsOf(graph, 'src/index.ts');

    expect(entrypointExports.map((exp) => exp.name).sort()).toEqual(['PublicMode', 'PublicReport']);
    expect(entrypointExports.every((exp) => exp.typeOnly)).toBe(true);
    expect(filesDefiningSymbol(graph, 'PublicReport')).toContain('src/index.ts');
  });

  it('reuses cached entries when mtime matches', async () => {
    const files = [await writeFile(tmp, 'src/a.ts', 'export function hi() {}')];
    const first = await buildCodeGraph(tmp, files);
    const second = await buildCodeGraph(tmp, files, first);
    // Same object references indicate cache reuse
    expect(second.files.get('src/a.ts')).toBe(first.files.get('src/a.ts'));
  });
});
