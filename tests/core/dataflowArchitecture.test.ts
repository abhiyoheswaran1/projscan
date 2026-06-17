import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

describe('dataflow maintainability', () => {
  it('keeps computeDataflow below the review high-CC threshold', async () => {
    const inspection = await inspectRepoSourceFile('src/core/dataflow.ts');
    const entrypoint = inspection.functions?.find((fn) => fn.name === 'computeDataflow');

    expect(entrypoint).toBeDefined();
    expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps extracted dataflow risk helpers below the review high-CC threshold', async () => {
    const inspection = await inspectRepoSourceFile('src/core/dataflowRiskAssembly.ts');
    const highComplexityHelpers =
      inspection.functions
        ?.filter((fn) => !fn.name.startsWith('<'))
        .filter((fn) => fn.cyclomaticComplexity > 8)
        .map((fn) => `${fn.name}:${fn.cyclomaticComplexity}`) ?? [];

    expect(highComplexityHelpers).toEqual([]);
  });
});

async function inspectRepoSourceFile(relativePath: string) {
  const root = process.cwd();
  const file = await fileEntry(root, relativePath);
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, relativePath, { scan: { files: [file] }, issues: [], graph });
}

async function fileEntry(root: string, relativePath: string): Promise<FileEntry> {
  const absolutePath = path.join(root, relativePath);
  const stat = await fs.stat(absolutePath);
  return {
    relativePath,
    absolutePath,
    extension: path.extname(relativePath).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(relativePath),
  };
}
