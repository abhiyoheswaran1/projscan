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

  it('reuses cached entries when mtime matches', async () => {
    const files = [await writeFile(tmp, 'src/a.ts', 'export function hi() {}')];
    const first = await buildCodeGraph(tmp, files);
    const second = await buildCodeGraph(tmp, files, first);
    // Same object references indicate cache reuse
    expect(second.files.get('src/a.ts')).toBe(first.files.get('src/a.ts'));
  });
});
