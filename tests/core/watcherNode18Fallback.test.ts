import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-watch-node18-'));
});

afterEach(async () => {
  vi.doUnmock('node:fs');
  vi.resetModules();
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

describe('startWatcher Node 18 fallback', () => {
  it('watches nested files when recursive fs.watch is unavailable', async () => {
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);

    vi.resetModules();
    vi.doMock('node:fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs')>();
      return {
        ...actual,
        watch: ((
          filename: Parameters<typeof actual.watch>[0],
          optionsOrListener: Parameters<typeof actual.watch>[1],
          listener?: Parameters<typeof actual.watch>[2],
        ) => {
          if (
            typeof optionsOrListener === 'object' &&
            optionsOrListener !== null &&
            'recursive' in optionsOrListener &&
            optionsOrListener.recursive === true
          ) {
            const err = new TypeError('recursive watch unavailable') as NodeJS.ErrnoException;
            err.code = 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM';
            throw err;
          }
          return actual.watch(filename, optionsOrListener, listener);
        }) as typeof actual.watch,
      };
    });

    const { startWatcher } = await import('../../src/core/watcher.js');
    const seen: string[][] = [];
    const errors: Error[] = [];
    const handle = startWatcher(tmp, {
      onChange: ({ paths }) => {
        if (paths.length > 0) seen.push(paths);
      },
      onError: (err) => errors.push(err),
    });
    await handle.ready;

    await sleep(50);
    await fs.writeFile(path.join(tmp, 'src/a.ts'), `export const a = 2;\n`, 'utf-8');
    await sleep(800);

    handle.close();
    await handle.closed;

    expect(errors).toEqual([]);
    expect(seen.flat()).toContain('src/a.ts');
  });
});
