import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  buildSearchIndex,
  search,
  tokenize,
  expandQuery,
  attachExcerpts,
} from '../../src/core/searchIndex.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-search-'));
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

describe('tokenize', () => {
  it('splits camelCase and snake_case', () => {
    expect(tokenize('userAuthToken')).toEqual(expect.arrayContaining(['user', 'auth', 'token']));
    expect(tokenize('user_auth_token')).toEqual(expect.arrayContaining(['user', 'auth', 'token']));
  });

  it('drops stopwords and TS keywords', () => {
    expect(tokenize('import the function')).not.toContain('import');
    expect(tokenize('import the function')).not.toContain('the');
    expect(tokenize('import the function')).not.toContain('function');
  });

  it('lightly stems plurals and -ing / -ed', () => {
    expect(tokenize('tokens')).toContain('token');
    expect(tokenize('running')).toContain('runn');
    expect(tokenize('parsed')).toContain('pars');
  });

  it('drops 1-character tokens', () => {
    expect(tokenize('a b c d')).toEqual([]);
  });
});

describe('expandQuery', () => {
  it('deduplicates tokens', () => {
    expect(expandQuery('auth auth token')).toEqual(['auth', 'token']);
  });
});

describe('buildSearchIndex + search', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('ranks files with direct term hits above others', async () => {
    const files = [
      await writeFile(tmp, 'src/auth.ts', 'export function authenticate(token: string) {}'),
      await writeFile(tmp, 'src/math.ts', 'export function add(a: number, b: number) { return a + b; }'),
    ];
    const graph = await buildCodeGraph(tmp, files);
    const index = await buildSearchIndex(tmp, files, graph);
    const hits = search(index, 'auth token', { limit: 10 });
    expect(hits[0].file).toBe('src/auth.ts');
  });

  it('boosts symbol matches above plain content matches', async () => {
    const files = [
      await writeFile(
        tmp,
        'src/mentions.ts',
        '// just mentions authenticate in a comment\n// authenticate is a word here\nexport const v = 1;',
      ),
      await writeFile(tmp, 'src/real.ts', 'export function authenticate() {}'),
    ];
    const graph = await buildCodeGraph(tmp, files);
    const index = await buildSearchIndex(tmp, files, graph);
    const hits = search(index, 'authenticate', { limit: 10 });
    expect(hits[0].file).toBe('src/real.ts');
    expect(hits[0].symbolMatch).toBe(true);
  });

  it('handles queries with no hits gracefully', async () => {
    const files = [await writeFile(tmp, 'src/a.ts', 'export const x = 1;')];
    const graph = await buildCodeGraph(tmp, files);
    const index = await buildSearchIndex(tmp, files, graph);
    expect(search(index, 'nonexistent_query_xyz')).toEqual([]);
  });

  it('matches on path tokens', async () => {
    const files = [
      await writeFile(tmp, 'src/payments/stripe.ts', 'export const x = 1;'),
      await writeFile(tmp, 'src/other.ts', 'export const x = 1;'),
    ];
    const graph = await buildCodeGraph(tmp, files);
    const index = await buildSearchIndex(tmp, files, graph);
    const hits = search(index, 'stripe');
    expect(hits[0]?.file).toBe('src/payments/stripe.ts');
    expect(hits[0]?.pathMatch).toBe(true);
  });

  it('splits camelCase query tokens too', async () => {
    const files = [
      await writeFile(tmp, 'src/handler.ts', 'export function onAuthSuccess() {}'),
    ];
    const graph = await buildCodeGraph(tmp, files);
    const index = await buildSearchIndex(tmp, files, graph);
    const hits = search(index, 'authSuccess');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].matched).toEqual(expect.arrayContaining(['auth', 'success']));
  });

  it('attachExcerpts fills line + excerpt', async () => {
    const files = [
      await writeFile(tmp, 'src/a.ts', '// line 1\nexport function authenticateX() {}\n'),
    ];
    const graph = await buildCodeGraph(tmp, files);
    const index = await buildSearchIndex(tmp, files, graph);
    const hits = search(index, 'authenticateX');
    const withExcerpts = await attachExcerpts(tmp, hits, ['authenticatex']);
    expect(withExcerpts[0].line).toBe(2);
    expect(withExcerpts[0].excerpt).toContain('authenticateX');
  });
});
