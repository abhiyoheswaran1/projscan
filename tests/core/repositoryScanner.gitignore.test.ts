import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanRepository } from '../../src/core/repositoryScanner.js';

const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-git-boundary-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const target = path.join(tmp, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

describe('scanRepository git privacy boundary', () => {
  it('respects .gitignore by default while keeping tracked and untracked non-ignored files', async () => {
    await git(['init', '-q']);
    await write('.gitignore', '.env\nsecrets/\nignored.ts\n');
    await write('src/index.ts', 'export const tracked = true;\n');
    await write('src/new.ts', 'export const untracked = true;\n');
    await write('.env', 'SECRET=local-only\n');
    await write('secrets/token.ts', 'export const fixtureValue = "visible-fixture";\n');
    await write('ignored.ts', 'export const ignored = true;\n');
    await git(['add', '.gitignore', 'src/index.ts']);

    const scan = await scanRepository(tmp);
    const paths = scan.files.map((file) => file.relativePath).sort();

    expect(paths).toEqual(['.gitignore', 'src/index.ts', 'src/new.ts']);
    expect(scan.scanBoundary).toMatchObject({
      source: 'git',
      gitignoreRespected: true,
      includeIgnored: false,
    });
    expect(scan.scanBoundary.ignoredFileCount).toBeGreaterThanOrEqual(3);
  });

  it('keeps tracked .env files visible by path even when .gitignore contains .env', async () => {
    await git(['init', '-q']);
    await write('.gitignore', '.env\n');
    await write('.env', 'SECRET=committed\n');
    await git(['add', '.gitignore']);
    await git(['add', '-f', '.env']);

    const scan = await scanRepository(tmp);
    const paths = scan.files.map((file) => file.relativePath).sort();

    expect(paths).toContain('.env');
    expect(scan.scanBoundary).toMatchObject({
      source: 'git',
      gitignoreRespected: true,
      includeIgnored: false,
    });
  });

  it('includes ignored files only when explicitly requested', async () => {
    await git(['init', '-q']);
    await write('.gitignore', '.env\nsecrets/\n');
    await write('src/index.ts', 'export const tracked = true;\n');
    await write('.env', 'SECRET=local-only\n');
    await write('secrets/token.ts', 'export const fixtureValue = "visible-fixture";\n');
    await git(['add', '.gitignore', 'src/index.ts']);

    const scan = await scanRepository(tmp, { includeIgnored: true });
    const paths = scan.files.map((file) => file.relativePath).sort();

    expect(paths).toEqual(
      expect.arrayContaining(['.env', '.gitignore', 'secrets/token.ts', 'src/index.ts']),
    );
    expect(scan.scanBoundary).toMatchObject({
      source: 'glob',
      gitignoreRespected: false,
      includeIgnored: true,
    });
  });

  it('honors .projscanrc ignore rules from direct scanner calls', async () => {
    await git(['init', '-q']);
    await write('.projscanrc.json', JSON.stringify({ ignore: ['private/**'] }));
    await write('src/index.ts', 'export const visible = true;\n');
    await write('private/notes.ts', 'export const hidden = true;\n');
    await git(['add', '.projscanrc.json', 'src/index.ts']);

    const scan = await scanRepository(tmp);
    const paths = scan.files.map((file) => file.relativePath).sort();

    expect(paths).toContain('.projscanrc.json');
    expect(paths).toContain('src/index.ts');
    expect(paths).not.toContain('private/notes.ts');
  });
});
