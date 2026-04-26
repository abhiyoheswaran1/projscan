import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/cycleCheck.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cyclecheck-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

describe('cycleCheck (cycle promotion to doctor)', () => {
  it('emits no issue when there are no cycles', async () => {
    await write('src/a.ts', `export const a = 1;\n`);
    await write('src/b.ts', `import { a } from './a.js';\nexport const b = a;\n`);
    const scan = await scanRepository(tmpDir);
    const issues = await check(tmpDir, scan.files);
    expect(issues).toEqual([]);
  });

  it('emits one warning issue for a 2-file cycle', async () => {
    await write('src/a.ts', `import { b } from './b.js';\nexport const a = b;\n`);
    await write('src/b.ts', `import { a } from './a.js';\nexport const b = a;\n`);
    const scan = await scanRepository(tmpDir);
    const issues = await check(tmpDir, scan.files);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].category).toBe('architecture');
    expect(issues[0].id).toMatch(/^cycle-detected-/);
    expect(issues[0].title).toMatch(/Circular imports/);
    const locFiles = (issues[0].locations ?? []).map((l) => l.file);
    expect(locFiles).toContain('src/a.ts');
    expect(locFiles).toContain('src/b.ts');
  });

  it('emits separate issues for two disjoint cycles', async () => {
    // Cycle 1: a <-> b
    await write('src/a.ts', `import { b } from './b.js';\nexport const a = b;\n`);
    await write('src/b.ts', `import { a } from './a.js';\nexport const b = a;\n`);
    // Cycle 2: c <-> d
    await write('src/c.ts', `import { d } from './d.js';\nexport const c = d;\n`);
    await write('src/d.ts', `import { c } from './c.js';\nexport const d = c;\n`);
    const scan = await scanRepository(tmpDir);
    const issues = await check(tmpDir, scan.files);
    expect(issues).toHaveLength(2);
  });

  it('detects 3-file cycles', async () => {
    await write('src/a.ts', `import { b } from './b.js';\nexport const a = b;\n`);
    await write('src/b.ts', `import { c } from './c.js';\nexport const b = c;\n`);
    await write('src/c.ts', `import { a } from './a.js';\nexport const c = a;\n`);
    const scan = await scanRepository(tmpDir);
    const issues = await check(tmpDir, scan.files);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toMatch(/3 files/);
  });
});
