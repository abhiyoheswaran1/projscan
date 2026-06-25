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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-count-ignored-'));
  await git(['init', '-q']);
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

describe('scanRepository ignored-file counting', () => {
  it('counts ignored files by default for compatibility', async () => {
    await write('.gitignore', 'ignored/\n');
    await write('src/index.ts', 'export const visible = true;\n');
    await write('ignored/local.ts', 'export const hidden = true;\n');
    await git(['add', '.gitignore', 'src/index.ts']);

    const scan = await scanRepository(tmp);

    expect(scan.files.map((file) => file.relativePath).sort()).toEqual([
      '.gitignore',
      'src/index.ts',
    ]);
    expect(scan.scanBoundary).toMatchObject({
      source: 'git',
      gitignoreRespected: true,
      includeIgnored: false,
    });
    expect(scan.scanBoundary.ignoredFileCount).toBeGreaterThanOrEqual(1);
  });

  it('can skip ignored-file counts while preserving visible-file scanning', async () => {
    await write('.gitignore', 'ignored/\n');
    await write('src/index.ts', 'export const visible = true;\n');
    await write('ignored/local.ts', 'export const hidden = true;\n');
    await git(['add', '.gitignore', 'src/index.ts']);

    const scan = await scanRepository(tmp, { countIgnoredFiles: false });

    expect(scan.files.map((file) => file.relativePath).sort()).toEqual([
      '.gitignore',
      'src/index.ts',
    ]);
    expect(scan.scanBoundary).toEqual({
      source: 'git',
      gitignoreRespected: true,
      includeIgnored: false,
      ignoredFileCount: 0,
    });
  });
});
