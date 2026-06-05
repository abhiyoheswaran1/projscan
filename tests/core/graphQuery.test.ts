import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { runGraphQuery } from '../../src/core/graphQuery.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-graphquery-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't', type: 'module' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src', 'util.ts'),
    `export function helper() { return 1; }\nexport const NAME = 'x';\n`,
  );
  await fs.writeFile(
    path.join(tmp, 'src', 'app.ts'),
    `import { helper } from './util.js';\nimport chalk from 'chalk';\nexport function main() { return helper() + chalk.red('h').length; }\n`,
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function graph() {
  const scan = await scanRepository(tmp);
  return await buildCodeGraph(tmp, scan.files);
}

describe('runGraphQuery', () => {
  it('imports: returns what a file imports', async () => {
    const out = runGraphQuery(await graph(), { direction: 'imports', file: 'src/app.ts' }) as {
      imports: unknown[];
    };
    expect(out.imports.length).toBeGreaterThan(0);
  });

  it('exports: returns what a file exports', async () => {
    const out = runGraphQuery(await graph(), { direction: 'exports', file: 'src/util.ts' }) as {
      exports: Array<{ name: string }>;
    };
    expect(out.exports.map((e) => e.name)).toEqual(expect.arrayContaining(['helper', 'NAME']));
  });

  it('importers: returns who imports a file', async () => {
    const out = runGraphQuery(await graph(), { direction: 'importers', file: 'src/util.ts' }) as {
      importers: string[];
    };
    expect(out.importers.some((f) => /app/.test(f))).toBe(true);
  });

  it('symbol_defs: returns files defining a symbol', async () => {
    const out = runGraphQuery(await graph(), { direction: 'symbol_defs', symbol: 'helper' }) as {
      definedIn: string[];
    };
    expect(out.definedIn.some((f) => /util/.test(f))).toBe(true);
  });

  it('package_importers: returns files importing a package', async () => {
    const out = runGraphQuery(await graph(), { direction: 'package_importers', symbol: 'chalk' }) as {
      importers: string[];
    };
    expect(out.importers.some((f) => /app/.test(f))).toBe(true);
  });

  it('respects limit', async () => {
    const out = runGraphQuery(await graph(), { direction: 'exports', file: 'src/util.ts', limit: 1 }) as {
      exports: unknown[];
    };
    expect(out.exports.length).toBe(1);
  });

  it('throws a helpful error when the required arg is missing', () => {
    // graph is unused here; the guard fires before any lookup.
    expect(() => runGraphQuery({ nodes: [], edges: [] } as never, { direction: 'imports' })).toThrow(
      /requires a `file`/,
    );
  });
});
