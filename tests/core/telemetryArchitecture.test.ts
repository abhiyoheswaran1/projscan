import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

describe('telemetry maintainability', () => {
  it('keeps telemetry config and queue storage helpers in a focused module', async () => {
    const telemetrySource = await readRepoSourceFile('src/core/telemetry.ts');
    const telemetry = await inspectRepoSourceFile('src/core/telemetry.ts');
    const config = await inspectRepoSourceFile('src/core/telemetryConfig.ts');

    expect(lineCount(telemetrySource)).toBeLessThanOrEqual(560);

    const telemetryFunctions = functionNames(telemetry);
    for (const helperName of [
      'buildStatus',
      'resolveTelemetryPaths',
      'readConfig',
      'normalizeConfig',
      'defaultConfig',
      'writeConfig',
      'appendQueue',
      'readQueue',
      'countQueue',
    ]) {
      expect(telemetryFunctions).not.toContain(helperName);
    }

    expect(functionNames(config)).toEqual(
      expect.arrayContaining([
        'buildTelemetryStatus',
        'resolveTelemetryPaths',
        'readTelemetryConfig',
        'normalizeTelemetryConfig',
        'defaultTelemetryConfig',
        'writeTelemetryConfig',
        'appendTelemetryQueue',
        'readTelemetryQueue',
        'countTelemetryQueue',
      ]),
    );
  });

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

async function readRepoSourceFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relativePath), 'utf-8');
}

function lineCount(source: string): number {
  return source.split('\n').length;
}

function functionNames(inspection: Awaited<ReturnType<typeof inspectRepoSourceFile>>): string[] {
  return inspection.functions?.map((fn) => fn.name) ?? [];
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
