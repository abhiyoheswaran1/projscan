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

  it('keeps incremental update implementation isolated from the graph facade', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'src/core/codeGraph.ts'), 'utf-8');

    expect(source).toContain("from './codeGraphIncremental.js'");
    expect(source).toContain("from './codeGraphAdapterContexts.js'");
    expect(source).toContain('export { incrementallyUpdateGraph }');
    expect(source).not.toContain('export async function incrementallyUpdateGraph');
    expect(source).not.toContain('function refreshLocalStarReexporters');
    expect(source).not.toContain('function fakeFilesFromGraph');
    expect(source).not.toContain('function rebuildIndexesIntoGraph');

    const incremental = await fs.readFile(
      path.join(process.cwd(), 'src/core/codeGraphIncremental.ts'),
      'utf-8',
    );
    const adapterContexts = await fs.readFile(
      path.join(process.cwd(), 'src/core/codeGraphAdapterContexts.ts'),
      'utf-8',
    );

    expect(incremental).toContain('export async function incrementallyUpdateGraph');
    expect(incremental).toContain('function refreshLocalStarReexporters');
    expect(incremental).toContain('function fakeFilesFromGraph');
    expect(incremental).toContain('function rebuildIndexesIntoGraph');
    expect(incremental).not.toContain("from './codeGraph.js'");
    expect(adapterContexts).toContain('export async function prepareAdapterContexts');
    expect(adapterContexts).not.toContain("from './codeGraph.js'");
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

  it('resolves jsconfig baseUrl-only imports to local files', async () => {
    await fs.writeFile(
      path.join(tmp, 'jsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.' } }),
    );
    const files = [
      await writeFile(tmp, 'src/lib/storage.ts', 'export const storage = 1;'),
      await writeFile(tmp, 'src/main.ts', "import { storage } from 'src/lib/storage';"),
    ];

    const graph = await buildCodeGraph(tmp, files);

    expect(filesImportingFile(graph, 'src/lib/storage.ts')).toEqual(['src/main.ts']);
    expect(filesImportingPackage(graph, 'src')).toEqual([]);
  });

  it('resolves path aliases inherited through extended configs', async () => {
    await fs.writeFile(
      path.join(tmp, 'tsconfig.base.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@shared/*': ['src/shared/*'] } } }),
    );
    await fs.mkdir(path.join(tmp, 'packages/app'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'packages/app/tsconfig.json'),
      JSON.stringify({ extends: '../../tsconfig.base.json' }),
    );
    const files = [
      await writeFile(tmp, 'src/shared/auth.ts', 'export function auth() { return 1; }'),
      await writeFile(
        tmp,
        'packages/app/src/main.ts',
        "import { auth } from '@shared/auth';\nauth();",
      ),
    ];

    const graph = await buildCodeGraph(tmp, files);

    expect(filesImportingFile(graph, 'src/shared/auth.ts')).toEqual(['packages/app/src/main.ts']);
    expect(filesImportingPackage(graph, '@shared/auth')).toEqual([]);
  });

  it('prefers the nearest package-level jsconfig for aliases', async () => {
    await fs.writeFile(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    );
    await fs.mkdir(path.join(tmp, 'packages/app'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'packages/app/jsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    );
    const files = [
      await writeFile(tmp, 'src/feature.ts', 'export const rootFeature = 1;'),
      await writeFile(tmp, 'packages/app/src/feature.ts', 'export const packageFeature = 1;'),
      await writeFile(
        tmp,
        'packages/app/src/main.ts',
        "import { packageFeature } from '@/feature';\npackageFeature();",
      ),
    ];

    const graph = await buildCodeGraph(tmp, files);

    expect(filesImportingFile(graph, 'packages/app/src/feature.ts')).toEqual([
      'packages/app/src/main.ts',
    ]);
    expect(filesImportingFile(graph, 'src/feature.ts')).toEqual([]);
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
