import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildImportGraph, toPackageName, filesImporting } from '../../src/core/importGraph.js';
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
  it('returns bare package names unchanged', () => {
    expect(toPackageName('react')).toBe('react');
    expect(toPackageName('lodash')).toBe('lodash');
  });

  it('extracts the package from sub-path imports', () => {
    expect(toPackageName('react/jsx-runtime')).toBe('react');
    expect(toPackageName('lodash/get')).toBe('lodash');
  });

  it('handles scoped packages with sub-paths', () => {
    expect(toPackageName('@scope/pkg')).toBe('@scope/pkg');
    expect(toPackageName('@scope/pkg/deep/path')).toBe('@scope/pkg');
  });

  it('returns null for relative imports', () => {
    expect(toPackageName('./local')).toBeNull();
    expect(toPackageName('../up')).toBeNull();
    expect(toPackageName('/abs')).toBeNull();
  });

  it('returns null for node builtins and node: specifiers', () => {
    expect(toPackageName('fs')).toBeNull();
    expect(toPackageName('path')).toBeNull();
    expect(toPackageName('node:fs')).toBeNull();
    expect(toPackageName('node:fs/promises')).toBeNull();
  });

  it('returns null for empty specifiers', () => {
    expect(toPackageName('')).toBeNull();
  });
});

describe('buildImportGraph', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('extracts ES imports and maps packages', async () => {
    const files = [
      await writeFile(tmp, 'src/a.ts', "import React from 'react';\nimport { join } from 'node:path';\nimport './local';"),
      await writeFile(tmp, 'src/b.ts', "import { get } from 'lodash/get';"),
    ];

    const graph = await buildImportGraph(tmp, files);
    expect(graph.scannedFiles).toBe(2);
    expect(graph.externalPackages.has('react')).toBe(true);
    expect(graph.externalPackages.has('lodash')).toBe(true);
    expect(graph.externalPackages.has('path')).toBe(false);
  });

  it('detects CommonJS requires', async () => {
    const files = [
      await writeFile(tmp, 'src/c.js', "const express = require('express');\nconst { resolve } = require('path');"),
    ];
    const graph = await buildImportGraph(tmp, files);
    expect(graph.externalPackages.has('express')).toBe(true);
    expect(graph.externalPackages.has('path')).toBe(false);
  });

  it('skips non-source files', async () => {
    const files = [
      await writeFile(tmp, 'README.md', "```js\nimport { foo } from 'bar';\n```"),
      await writeFile(tmp, 'src/d.ts', "import { real } from 'real-pkg';"),
    ];
    const graph = await buildImportGraph(tmp, files);
    expect(graph.externalPackages.has('bar')).toBe(false);
    expect(graph.externalPackages.has('real-pkg')).toBe(true);
  });

  it('filesImporting returns relative paths of importers', async () => {
    const files = [
      await writeFile(tmp, 'src/a.ts', "import chalk from 'chalk';"),
      await writeFile(tmp, 'src/b.ts', "import chalk from 'chalk';"),
      await writeFile(tmp, 'src/c.ts', "import fs from 'node:fs';"),
    ];
    const graph = await buildImportGraph(tmp, files);
    expect(filesImporting(graph, 'chalk').sort()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(filesImporting(graph, 'nonexistent')).toEqual([]);
  });
});
