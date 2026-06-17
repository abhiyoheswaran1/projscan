import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

describe('telemetry maintainability', () => {
  it('keeps command categorization below the review high-CC threshold', async () => {
    const inspection = await inspectRepoSourceFile('src/core/telemetry.ts');
    const classifier = inspection.functions?.find((fn) => fn.name === 'categorizeCommand');

    expect(classifier).toBeDefined();
    expect(classifier!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps telemetry flushing below the review high-CC threshold', async () => {
    const inspection = await inspectRepoSourceFile('src/core/telemetry.ts');
    const flush = inspection.functions?.find((fn) => fn.name === 'flushTelemetry');

    expect(flush).toBeDefined();
    expect(flush!.cyclomaticComplexity).toBeLessThanOrEqual(8);
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
