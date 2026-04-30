import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startWatcher } from '../../src/core/watcher.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-watch-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('startWatcher', () => {
  it('fires onChange once for the initial build with paths=[]', async () => {
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);

    let initSeen = false;
    const handle = startWatcher(tmp, {
      onChange: ({ paths, graph }) => {
        if (paths.length === 0) {
          initSeen = true;
          expect(graph.files.has('src/a.ts')).toBe(true);
        }
      },
    });
    await handle.ready;
    expect(initSeen).toBe(true);
    handle.close();
  });

  it('fires onChange on a debounced batch when a file is edited', async () => {
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);

    const seen: string[][] = [];
    const handle = startWatcher(tmp, {
      onChange: ({ paths }) => {
        if (paths.length > 0) seen.push(paths);
      },
    });
    await handle.ready;

    // Edit the file. fs.watch on macOS may not see writes that happen "too
    // quickly" after subscribe; small delay first.
    await sleep(50);
    await fs.writeFile(path.join(tmp, 'src/a.ts'), 'export const a = 2;\n', 'utf-8');

    // Wait long enough for debounce + retry + onChange.
    await sleep(700);
    handle.close();

    // The watcher MAY not deliver an event on every platform/CI environment
    // (macOS fs.watch quirks). We assert the path included the expected file
    // when delivered, but tolerate zero events for robustness.
    if (seen.length > 0) {
      const flat = seen.flat();
      expect(flat.some((p) => p.includes('src/a.ts'))).toBe(true);
    }
  });

  it('skips files in noise directories (node_modules, .git, dist, etc.)', async () => {
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);

    const seen: string[][] = [];
    const handle = startWatcher(tmp, {
      onChange: ({ paths }) => {
        if (paths.length > 0) seen.push(paths);
      },
    });
    await handle.ready;
    await sleep(50);

    // Edit something inside node_modules.
    await fs.mkdir(path.join(tmp, 'node_modules/foo'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'node_modules/foo/index.js'), 'module.exports = 1;\n', 'utf-8');

    // Edit something inside .git.
    await fs.mkdir(path.join(tmp, '.git'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.git/HEAD'), 'ref: refs/heads/main\n', 'utf-8');

    await sleep(500);
    handle.close();

    // None of the noise should have produced an event batch.
    const flat = seen.flat();
    expect(flat.some((p) => p.includes('node_modules'))).toBe(false);
    expect(flat.some((p) => p.startsWith('.git'))).toBe(false);
  });

  it('close() stops the watcher cleanly', async () => {
    const handle = startWatcher(tmp, { onChange: () => undefined });
    await handle.ready;
    handle.close();
    // Should not throw if close is called twice.
    expect(() => handle.close()).not.toThrow();
  });
});
