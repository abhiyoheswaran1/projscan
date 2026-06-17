import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../src/types.js';
import type { LanguageAdapter } from '../../src/core/languages/LanguageAdapter.js';

interface ParseableGraphInput {
  file: FileEntry;
  adapter: LanguageAdapter;
}

interface CodeGraphFileSelectionModule {
  selectParseableGraphInputs(files: FileEntry[]): ParseableGraphInput[];
}

function fileEntry(relativePath: string, sizeBytes: number): FileEntry {
  return {
    relativePath,
    absolutePath: path.join('/repo', relativePath),
    directory: path.dirname(relativePath),
    extension: path.extname(relativePath).toLowerCase(),
    sizeBytes,
  };
}

async function importSelectionHelper(): Promise<CodeGraphFileSelectionModule> {
  const helperPath = path.join(process.cwd(), 'src/core/codeGraphFileSelection.ts');
  const exists = await fs.access(helperPath).then(
    () => true,
    () => false,
  );
  expect(exists).toBe(true);
  if (!exists) {
    return { selectParseableGraphInputs: () => [] };
  }

  const modulePath = '../../src/core/' + 'codeGraphFileSelection.js';
  return (await import(modulePath)) as CodeGraphFileSelectionModule;
}

describe('code graph file selection', () => {
  it('keeps parseable-file selection isolated from graph orchestration', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'src/core/codeGraph.ts'), 'utf-8');

    expect(source).toContain("from './codeGraphFileSelection.js'");
    expect(source).toContain('selectParseableGraphInputs(files)');
    expect(source).not.toContain('getAdapterFor(f.relativePath)');
    expect(source).not.toContain('MAX_FILE_SIZE');
  });

  it('excludes unsupported and oversized files while keeping parseable adapter-backed files', async () => {
    const { selectParseableGraphInputs } = await importSelectionHelper();

    const selected = selectParseableGraphInputs([
      fileEntry('src/a.ts', 128),
      fileEntry('README.md', 128),
      fileEntry('src/huge.ts', 1024 * 1024 + 1),
    ]);

    expect(selected.map((input) => input.file.relativePath)).toEqual(['src/a.ts']);
    expect(selected[0]?.adapter.id).toBe('javascript');
  });
});
