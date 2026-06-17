import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfigSource } from '../../src/utils/configSources.js';

describe('loadConfigSource', () => {
  it('loads an explicit config path relative to the project root', async () => {
    const root = await makeTempDir();
    await fs.writeFile(path.join(root, 'custom.json'), JSON.stringify({ minScore: 70 }));

    const source = await loadConfigSource(root, 'custom.json');

    expect(source).toEqual({
      value: { minScore: 70 },
      source: path.join(root, 'custom.json'),
    });
  });

  it('prefers .projscanrc.json before package metadata', async () => {
    const root = await makeTempDir();
    await fs.writeFile(path.join(root, '.projscanrc.json'), JSON.stringify({ minScore: 80 }));
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ projscan: { minScore: 90 } }),
    );

    const source = await loadConfigSource(root);

    expect(source).toEqual({
      value: { minScore: 80 },
      source: path.join(root, '.projscanrc.json'),
    });
  });

  it('loads package metadata when no rc file exists', async () => {
    const root = await makeTempDir();
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'fixture', projscan: { ignore: ['dist'] } }),
    );

    const source = await loadConfigSource(root);

    expect(source).toEqual({
      value: { ignore: ['dist'] },
      source: `${path.join(root, 'package.json')}#projscan`,
    });
  });

  it('returns null when no config source exists', async () => {
    await expect(loadConfigSource(await makeTempDir())).resolves.toBeNull();
  });

  it('throws with the config path when JSON is malformed', async () => {
    const root = await makeTempDir();
    await fs.writeFile(path.join(root, '.projscanrc.json'), '{ bad }');

    await expect(loadConfigSource(root)).rejects.toThrow(/Invalid JSON in .*\.projscanrc\.json/);
  });
});

function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-config-source-'));
}
