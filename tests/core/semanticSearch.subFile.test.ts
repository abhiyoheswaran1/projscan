import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildChunks } from '../../src/core/semanticSearch.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-subfile-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

describe('buildChunks (sub-file embedding chunk extraction)', () => {
  it('emits one chunk per file in default (file-level) mode', async () => {
    await write('src/a.ts', `export function foo() {}\nexport function bar() {}\n`);
    await write('src/b.ts', `export const x = 1;\n`);
    const scan = await scanRepository(tmp);
    const chunks = await buildChunks(tmp, scan.files);
    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.key).sort()).toEqual(['src/a.ts', 'src/b.ts']);
    // No function context on file-level chunks.
    expect(chunks.every((c) => c.function === undefined)).toBe(true);
  });

  it('emits one chunk per function when subFile + graph are provided', async () => {
    await write(
      'src/a.ts',
      `export function foo() {\n  return 1;\n}\n\nexport function bar(x: number) {\n  if (x) return 1;\n  return 0;\n}\n`,
    );
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const chunks = await buildChunks(tmp, scan.files, { subFile: true, graph });
    // Exactly two function chunks for src/a.ts; no file-level chunk for it.
    const aChunks = chunks.filter((c) => c.relativePath === 'src/a.ts');
    expect(aChunks).toHaveLength(2);
    const fooChunk = aChunks.find((c) => c.key === 'src/a.ts#foo');
    const barChunk = aChunks.find((c) => c.key === 'src/a.ts#bar');
    expect(fooChunk).toBeDefined();
    expect(barChunk).toBeDefined();
    expect(fooChunk!.function?.name).toBe('foo');
    expect(barChunk!.function?.name).toBe('bar');
    expect(fooChunk!.text).toContain('foo');
    expect(barChunk!.text).toContain('bar');
  });

  it('includes the matched line range in the chunk text', async () => {
    await write('src/a.ts', ['', 'export function foo() {', '  return 1;', '}', ''].join('\n'));
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const chunks = await buildChunks(tmp, scan.files, { subFile: true, graph });
    const fooChunk = chunks.find((c) => c.key === 'src/a.ts#foo');
    expect(fooChunk).toBeDefined();
    // Header line should reference the function and the line range.
    expect(fooChunk!.text.split('\n')[0]).toMatch(/src\/a\.ts#foo \(lines 2-4\)/);
    // Body should include the function source.
    expect(fooChunk!.text).toContain('return 1;');
  });

  it('falls back to file-level for files with no extracted functions', async () => {
    // .md files are indexable but the language adapter doesn't emit functions for them.
    await write('docs/README.md', `# Hello\n\nSome content.`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const chunks = await buildChunks(tmp, scan.files, { subFile: true, graph });
    const md = chunks.find((c) => c.relativePath === 'docs/README.md');
    expect(md).toBeDefined();
    expect(md!.key).toBe('docs/README.md');
    expect(md!.function).toBeUndefined();
  });

  it('hash differs between two functions in the same file', async () => {
    await write(
      'src/a.ts',
      `export function foo() { return 1; }\nexport function bar() { return 2; }\n`,
    );
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const chunks = await buildChunks(tmp, scan.files, { subFile: true, graph });
    const fooHash = chunks.find((c) => c.key === 'src/a.ts#foo')!.hash;
    const barHash = chunks.find((c) => c.key === 'src/a.ts#bar')!.hash;
    expect(fooHash).not.toBe(barHash);
  });

  it('subFile without a graph silently falls back to file-level', async () => {
    await write('src/a.ts', `export function foo() {}\n`);
    const scan = await scanRepository(tmp);
    // graph not provided
    const chunks = await buildChunks(tmp, scan.files, { subFile: true });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].key).toBe('src/a.ts');
    expect(chunks[0].function).toBeUndefined();
  });
});
