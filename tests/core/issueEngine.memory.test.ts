import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const memoryState = vi.hoisted(() => {
  let resolveSave: (() => void) | undefined;
  const makeSavePromise = () => new Promise<void>((resolve) => {
    resolveSave = resolve;
  });
  return {
    saveStarted: false,
    savePromise: makeSavePromise(),
    reset() {
      this.saveStarted = false;
      this.savePromise = makeSavePromise();
    },
    resolveSave() {
      resolveSave?.();
    },
  };
});

vi.mock('../../src/core/memory.js', () => ({
  loadMemory: vi.fn(async () => ({
    schemaVersion: 1,
    lastUpdatedAt: new Date(0).toISOString(),
    rules: {},
    hotspots: {},
    totalRuns: 0,
  })),
  recordRun: vi.fn(),
  saveMemory: vi.fn(async () => {
    memoryState.saveStarted = true;
    await memoryState.savePromise;
  }),
}));

import { collectIssues } from '../../src/core/issueEngine.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmp: string;

beforeEach(async () => {
  memoryState.reset();
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-issue-memory-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n', 'utf-8');
});

afterEach(async () => {
  memoryState.resolveSave();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('collectIssues Project Memory persistence', () => {
  it('waits for best-effort memory persistence before resolving', async () => {
    const scan = await scanRepository(tmp);
    let settled = false;
    const collection = collectIssues(tmp, scan.files).then(() => {
      settled = true;
    });

    await waitFor(() => memoryState.saveStarted);
    await Promise.resolve();

    expect(settled).toBe(false);

    memoryState.resolveSave();
    await collection;
    expect(settled).toBe(true);
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('condition was not met in time');
}
