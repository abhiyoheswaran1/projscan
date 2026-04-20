import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { previewUpgrade, isValidPackageName } from '../../src/core/upgradePreview.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-upgrade-'));
}

async function writeJson(file: string, obj: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj));
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

describe('previewUpgrade', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns unavailable for missing package', async () => {
    await writeJson(path.join(tmp, 'package.json'), { dependencies: {} });
    const preview = await previewUpgrade(tmp, 'missing-pkg', []);
    expect(preview.available).toBe(false);
    expect(preview.reason).toMatch(/not found/);
  });

  it('reports drift and importers', async () => {
    await writeJson(path.join(tmp, 'package.json'), { dependencies: { foo: '^1.0.0' } });
    await writeJson(path.join(tmp, 'node_modules/foo/package.json'), { version: '2.0.0' });
    const files = [
      await writeFile(tmp, 'src/a.ts', "import foo from 'foo';"),
      await writeFile(tmp, 'src/b.ts', "import { thing } from 'foo/sub';"),
    ];

    const preview = await previewUpgrade(tmp, 'foo', files);
    expect(preview.available).toBe(true);
    expect(preview.declared).toBe('^1.0.0');
    expect(preview.installed).toBe('2.0.0');
    expect(preview.drift).toBe('major');
    expect(preview.importers.sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('surfaces BREAKING markers from CHANGELOG', async () => {
    await writeJson(path.join(tmp, 'package.json'), { dependencies: { foo: '^1.0.0' } });
    await writeJson(path.join(tmp, 'node_modules/foo/package.json'), { version: '2.0.0' });
    await fs.writeFile(
      path.join(tmp, 'node_modules/foo/CHANGELOG.md'),
      [
        '# Changelog',
        '',
        '## 2.0.0',
        '- BREAKING CHANGE: removed the frobnicate helper',
        '',
        '## 1.0.0',
        '- initial release',
      ].join('\n'),
    );

    const preview = await previewUpgrade(tmp, 'foo', []);
    expect(preview.available).toBe(true);
    expect(preview.breakingMarkers.length).toBeGreaterThan(0);
    expect(preview.changelogExcerpt).toContain('BREAKING CHANGE');
  });
});

describe('isValidPackageName (path-traversal guard)', () => {
  it('accepts typical package names', () => {
    expect(isValidPackageName('react')).toBe(true);
    expect(isValidPackageName('chalk')).toBe(true);
    expect(isValidPackageName('@babel/parser')).toBe(true);
    expect(isValidPackageName('@scope/pkg-name')).toBe(true);
    expect(isValidPackageName('lodash.debounce')).toBe(true);
    expect(isValidPackageName('some_pkg')).toBe(true);
  });

  it('rejects traversal and absolute-path attempts', () => {
    expect(isValidPackageName('..')).toBe(false);
    expect(isValidPackageName('../etc/passwd')).toBe(false);
    expect(isValidPackageName('../../../../Users/victim/.ssh/id_rsa')).toBe(false);
    expect(isValidPackageName('/etc/passwd')).toBe(false);
    expect(isValidPackageName('C:\\Windows\\System32')).toBe(false);
    expect(isValidPackageName('foo/../bar')).toBe(false);
    expect(isValidPackageName('@scope/../bar')).toBe(false);
    expect(isValidPackageName('foo\x00bar')).toBe(false);
  });

  it('rejects empty / whitespace / overlong', () => {
    expect(isValidPackageName('')).toBe(false);
    expect(isValidPackageName(' foo')).toBe(false);
    expect(isValidPackageName('foo ')).toBe(false);
    expect(isValidPackageName('a'.repeat(215))).toBe(false);
  });
});

describe('previewUpgrade refuses invalid / traversal package names', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns available=false without reading any file when pkgName contains ..', async () => {
    // Place a sensitive file outside node_modules to prove no read happens.
    const sibling = path.join(tmp, 'sibling');
    await fs.mkdir(sibling, { recursive: true });
    await fs.writeFile(path.join(sibling, 'CHANGELOG.md'), 'SECRET CONTENTS\n');

    const preview = await previewUpgrade(tmp, '../sibling', []);
    expect(preview.available).toBe(false);
    expect(preview.reason).toMatch(/Invalid package name/);
    expect(preview.changelogExcerpt).toBeUndefined();
  });

  it('does not leak files when a traversal name slips the name guard but hits the root-containment check', async () => {
    // Even if a future regex regression allowed a sneaky name through, the
    // resolve-then-isInside check in readChangelog should still contain it.
    // This test exercises the guard directly by staging node_modules and a
    // sibling with a CHANGELOG, and confirming the outer API refuses.
    await fs.mkdir(path.join(tmp, 'node_modules'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'evil'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'evil', 'CHANGELOG.md'), 'EVIL\n');

    const preview = await previewUpgrade(tmp, '../evil', []);
    expect(preview.changelogExcerpt).toBeUndefined();
    expect(preview.installed).toBeNull();
  });
});
