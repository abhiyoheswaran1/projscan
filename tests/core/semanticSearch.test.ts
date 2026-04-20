import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  buildSemanticIndex,
  semanticSearch,
  reciprocalRankFusion,
} from '../../src/core/semanticSearch.js';
import { __resetEmbeddingsCache } from '../../src/core/embeddings.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-semantic-'));
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

describe('reciprocalRankFusion', () => {
  it('merges two ranked lists so the file that appears near the top of both wins', () => {
    const lexical = [{ file: 'a.ts' }, { file: 'b.ts' }, { file: 'c.ts' }];
    const semantic = [{ file: 'c.ts' }, { file: 'a.ts' }, { file: 'd.ts' }];
    const fused = reciprocalRankFusion([lexical, semantic]);
    // `a.ts` is #1 in lexical and #2 in semantic; `c.ts` is #3 and #1.
    // Both should be near the top; everything else below.
    const top2 = new Set(fused.slice(0, 2).map((f) => f.file));
    expect(top2).toEqual(new Set(['a.ts', 'c.ts']));
  });

  it('returns exactly the entries that appeared in at least one list', () => {
    const fused = reciprocalRankFusion([
      [{ file: 'x' }],
      [{ file: 'y' }, { file: 'z' }],
    ]);
    expect(fused.map((f) => f.file).sort()).toEqual(['x', 'y', 'z']);
  });
});

describe('buildSemanticIndex + semanticSearch', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
    __resetEmbeddingsCache();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it(
    'ranks semantically related files above unrelated ones',
    async () => {
      const files = [
        await writeFile(
          tmp,
          'src/auth.ts',
          'export function login(password: string) { /* verify hashed password against stored digest */ return true; }',
        ),
        await writeFile(
          tmp,
          'src/mailer.ts',
          'export async function sendTransactionalEmail(to: string, body: string) { /* SMTP delivery */ }',
        ),
      ];
      const index = await buildSemanticIndex(tmp, files);
      expect(index).not.toBeNull();
      const hits = await semanticSearch(index!, 'verifying user credentials', { limit: 2 });
      expect(hits[0].file).toBe('src/auth.ts');
    },
    90_000,
  );

  it(
    'reuses cached embeddings on the second build',
    async () => {
      const files = [
        await writeFile(tmp, 'src/a.ts', 'export function something() {}'),
      ];
      const t0 = Date.now();
      await buildSemanticIndex(tmp, files);
      const cold = Date.now() - t0;

      const t1 = Date.now();
      await buildSemanticIndex(tmp, files);
      const warm = Date.now() - t1;

      // Warm run should be faster; exact threshold is CI-sensitive so we
      // only require it's at least 2× faster.
      expect(warm).toBeLessThan(cold / 2);
    },
    120_000,
  );
});
