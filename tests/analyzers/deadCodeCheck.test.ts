import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/deadCodeCheck.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-deadcode-'));
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

describe('deadCodeCheck', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('flags exports that nothing imports', async () => {
    const files = [
      await writeFile(tmp, 'src/dead.ts', 'export function unused() {}\nexport const alsoUnused = 1;'),
      await writeFile(tmp, 'src/used.ts', 'export function active() {}'),
      await writeFile(tmp, 'src/main.ts', "import { active } from './used.js';\nactive();"),
    ];
    // package.json points at main.ts as the public entry
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'x', main: 'src/main.ts' }),
    );

    const issues = await check(tmp, files);
    const deadIssue = issues.find((i) => i.id === 'unused-exports-src/dead.ts');
    expect(deadIssue).toBeDefined();
    expect(deadIssue?.severity).toBe('info');
    expect(deadIssue?.locations?.[0].file).toBe('src/dead.ts');

    expect(issues.find((i) => i.id === 'unused-exports-src/used.ts')).toBeUndefined();
    expect(issues.find((i) => i.id === 'unused-exports-src/main.ts')).toBeUndefined();
  });

  it('skips test files', async () => {
    const files = [
      await writeFile(tmp, 'tests/foo.test.ts', 'export function iso() {}'),
    ];
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'x' }));
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('skips barrel (index) files', async () => {
    const files = [
      await writeFile(tmp, 'src/index.ts', "export { foo } from './foo.js';"),
      await writeFile(tmp, 'src/foo.ts', 'export function foo() {}'),
    ];
    await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'x' }));
    const issues = await check(tmp, files);
    // src/foo.ts is reachable through index.ts; neither should be flagged
    expect(issues).toEqual([]);
  });

  it('skips files listed as public entries in package.json', async () => {
    const files = [await writeFile(tmp, 'src/bin.ts', 'export function main() {}')];
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'x', bin: { x: 'src/bin.ts' } }),
    );
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('treats imports with ".js" that resolve to ".ts" as used', async () => {
    const files = [
      await writeFile(tmp, 'src/helper.ts', 'export function help() {}'),
      await writeFile(tmp, 'src/main.ts', "import { help } from './helper.js';\nhelp();"),
    ];
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'x', main: 'src/main.ts' }),
    );
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'unused-exports-src/helper.ts')).toBeUndefined();
  });

  it('flags dead Python modules with named exports', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/used.py', 'def used():\n    pass\n'),
      await writeFile(tmp, 'pkg/dead.py', 'def never_called():\n    pass\n\nCONSTANT = 1\n'),
      await writeFile(tmp, 'pkg/main.py', 'from .used import used\n\nused()\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'unused-exports-pkg/dead.py')).toBeDefined();
    expect(issues.find((i) => i.id === 'unused-exports-pkg/used.py')).toBeUndefined();
    expect(issues.find((i) => i.id === 'unused-exports-pkg/main.py')).toBeDefined();
  });

  it('does not flag __init__.py as dead (barrel equivalent)', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', 'from .util import helper\n__all__ = ["helper"]\n'),
      await writeFile(tmp, 'pkg/util.py', 'def helper():\n    pass\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'unused-exports-pkg/__init__.py')).toBeUndefined();
  });

  it('skips pytest-convention test files', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/test_module.py', 'def test_something():\n    pass\n'),
      await writeFile(tmp, 'pkg/util_test.py', 'def test_other():\n    pass\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.filter((i) => i.id.startsWith('unused-exports-'))).toEqual([]);
  });

  it('uses "names" (not "exports") in message for Python', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/lonely.py', 'def lonely():\n    pass\n'),
    ];
    const issues = await check(tmp, files);
    const dead = issues.find((i) => i.id === 'unused-exports-pkg/lonely.py');
    expect(dead?.title).toMatch(/Unused names/);
  });
});
