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

  it('keeps telemetry event shaping helpers in a focused module', async () => {
    const telemetrySource = await readRepoSourceFile('src/core/telemetry.ts');
    const telemetry = await inspectRepoSourceFile('src/core/telemetry.ts');
    const events = await inspectRepoSourceFile('src/core/telemetryEvents.ts');

    expect(lineCount(telemetrySource)).toBeLessThanOrEqual(360);

    const telemetryFunctions = functionNames(telemetry);
    for (const helperName of [
      'buildCommandEvent',
      'categorizeCommand',
      'sanitizeCommandName',
      'sanitizeVersion',
      'bucketDuration',
      'bucketMinutes',
      'bucketCount',
      'detectSetup',
      'anyExists',
      'exists',
    ]) {
      expect(telemetryFunctions).not.toContain(helperName);
    }

    expect(functionNames(events)).toEqual(
      expect.arrayContaining([
        'buildTelemetryCommandEvent',
        'buildFeedbackTelemetry',
        'categorizeTelemetryCommand',
        'sanitizeTelemetryCommandName',
        'sanitizeTelemetryVersion',
        'bucketTelemetryDuration',
        'bucketTelemetryMinutes',
        'bucketTelemetryCount',
        'detectTelemetrySetup',
      ]),
    );
  });

  it('keeps command telemetry recording below the review high-CC threshold', async () => {
    const inspection = await inspectRepoSourceFile('src/core/telemetry.ts');
    const classifier = inspection.functions?.find((fn) => fn.name === 'recordCommandTelemetry');

    expect(classifier).toBeDefined();
    expect(classifier!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps telemetry flushing below the review high-CC threshold', async () => {
    const inspection = await inspectRepoSourceFile('src/core/telemetry.ts');
    const flush = inspection.functions?.find((fn) => fn.name === 'flushTelemetry');

    expect(flush).toBeDefined();
    expect(flush!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps the network sender implementation in a focused helper module', async () => {
    const telemetrySource = await readRepoSourceFile('src/core/telemetry.ts');
    expect(telemetrySource).toContain("from './telemetrySender.js'");
    expect(telemetrySource).not.toContain('function defaultSender');
    expect(telemetrySource).not.toContain('REQUEST_TIMEOUT_MS');
    expect(telemetrySource).not.toContain('new AbortController');
    expect(telemetrySource).not.toContain('fetch(endpoint');

    const senderSource = await readRepoSourceFile('src/core/telemetrySender.ts');
    expect(senderSource).toContain('new AbortController');
    expect(senderSource).toContain('fetch(endpoint');

    const sender = await inspectRepoSourceFile('src/core/telemetrySender.ts');
    const defaultSender = sender.functions?.find((fn) => fn.name === 'defaultTelemetrySender');
    expect(defaultSender).toBeDefined();
    expect(defaultSender!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps telemetry flushing in a focused helper module', async () => {
    const telemetrySource = await readRepoSourceFile('src/core/telemetry.ts');
    expect(telemetrySource).toContain("from './telemetryFlushing.js'");
    expect(telemetrySource).not.toContain('readTelemetryQueue');
    expect(telemetrySource).not.toContain('sendQueuedTelemetry');
    expect(telemetrySource).not.toContain('defaultTelemetrySender');

    const telemetry = await inspectRepoSourceFile('src/core/telemetry.ts');
    const flushFacade = telemetry.functions?.find((fn) => fn.name === 'flushTelemetry');
    expect(flushFacade).toBeDefined();
    expect(flushFacade!.cyclomaticComplexity).toBeLessThanOrEqual(2);

    const flushingSource = await readRepoSourceFile('src/core/telemetryFlushing.ts');
    expect(flushingSource).toContain('readTelemetryQueue');
    expect(flushingSource).toContain('clearTelemetryQueue');
    expect(flushingSource).toContain('defaultTelemetrySender');
    expect(flushingSource).toContain('sendQueuedTelemetry');

    const flushing = await inspectRepoSourceFile('src/core/telemetryFlushing.ts');
    const flushHelper = flushing.functions?.find((fn) => fn.name === 'flushTelemetry');
    expect(flushHelper).toBeDefined();
    expect(flushHelper!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps telemetry event recording in a focused helper module', async () => {
    const telemetrySource = await readRepoSourceFile('src/core/telemetry.ts');
    expect(telemetrySource).toContain("from './telemetryRecording.js'");
    expect(telemetrySource).not.toContain('buildTelemetryCommandEvent');
    expect(telemetrySource).not.toContain('appendTelemetryQueue');
    expect(telemetrySource).not.toContain('updateTelemetryUsage');

    const telemetry = await inspectRepoSourceFile('src/core/telemetry.ts');
    const recordFacade = telemetry.functions?.find((fn) => fn.name === 'recordCommandTelemetry');
    expect(recordFacade).toBeDefined();
    expect(recordFacade!.cyclomaticComplexity).toBeLessThanOrEqual(2);

    const recordingSource = await readRepoSourceFile('src/core/telemetryRecording.ts');
    expect(recordingSource).toContain('buildTelemetryCommandEvent');
    expect(recordingSource).toContain('buildFeedbackTelemetry');
    expect(recordingSource).toContain('appendTelemetryQueue');
    expect(recordingSource).toContain('updateTelemetryUsage');

    const recording = await inspectRepoSourceFile('src/core/telemetryRecording.ts');
    expect(functionNames(recording)).toEqual(
      expect.arrayContaining(['recordCommandTelemetry', 'recordFeedbackTelemetry']),
    );
    const recordHelper = recording.functions?.find((fn) => fn.name === 'recordCommandTelemetry');
    expect(recordHelper).toBeDefined();
    expect(recordHelper!.cyclomaticComplexity).toBeLessThanOrEqual(8);
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
