import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { previewUpgrade } from '../../src/core/upgradePreview.js';
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
