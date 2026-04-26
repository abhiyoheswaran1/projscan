import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/crossPackageImportCheck.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-crosspkg-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

async function setupMonorepo(): Promise<void> {
  await write(
    'package.json',
    JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
  );
  await write('packages/a/package.json', JSON.stringify({ name: 'a' }));
  await write('packages/b/package.json', JSON.stringify({ name: 'b' }));
  // a imports from b
  await write('packages/a/src/index.ts', `import { thing } from '../../b/src/index.js';\nexport const useA = thing;\n`);
  await write('packages/b/src/index.ts', `export const thing = 1;\n`);
}

describe('crossPackageImportCheck', () => {
  it('is a no-op when no .projscanrc importPolicy is configured', async () => {
    await setupMonorepo();
    const scan = await scanRepository(tmp);
    const issues = await check(tmp, scan.files);
    expect(issues).toEqual([]);
  });

  it('flags edges that violate a deny rule', async () => {
    await setupMonorepo();
    await write(
      '.projscanrc.json',
      JSON.stringify({
        monorepo: {
          importPolicy: [{ from: 'a', deny: ['b'] }],
        },
      }),
    );
    const scan = await scanRepository(tmp);
    const issues = await check(tmp, scan.files);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].id).toMatch(/^cross-package-violation-/);
    expect(issues[0].title).toMatch(/from "a" to "b"/);
    expect(issues[0].locations?.[0].file).toBe('packages/a/src/index.ts');
  });

  it('allows edges that match an allow-list', async () => {
    await setupMonorepo();
    await write(
      '.projscanrc.json',
      JSON.stringify({
        monorepo: {
          importPolicy: [{ from: 'a', allow: ['b'] }],
        },
      }),
    );
    const scan = await scanRepository(tmp);
    const issues = await check(tmp, scan.files);
    expect(issues).toEqual([]);
  });

  it('denies edges not in the allow-list (allow-list semantics)', async () => {
    await setupMonorepo();
    await write(
      '.projscanrc.json',
      JSON.stringify({
        monorepo: {
          importPolicy: [{ from: 'a', allow: ['c', 'd'] }],
        },
      }),
    );
    const scan = await scanRepository(tmp);
    const issues = await check(tmp, scan.files);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('is a no-op for single-package repos', async () => {
    await write('package.json', JSON.stringify({ name: 'single' }));
    await write('src/a.ts', `export const a = 1;`);
    await write('src/b.ts', `import { a } from './a.js';\nexport const b = a;`);
    await write('.projscanrc.json', JSON.stringify({ monorepo: { importPolicy: [{ from: 'a', deny: ['b'] }] } }));
    const scan = await scanRepository(tmp);
    const issues = await check(tmp, scan.files);
    expect(issues).toEqual([]);
  });
});
