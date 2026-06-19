import { expect, test } from 'vitest';
import {
  loadPreflightInputsWithDeps,
  type PreflightInputDependencies,
} from '../../src/core/preflightInputs.js';
import type { FileEntry } from '../../src/types.js';

test('preflight overlaps review with repository scanning but waits to coordinate', async () => {
  const events: string[] = [];
  const scan = deferred<{ files: FileEntry[] }>();
  const review = deferred<{ available: false; reason: string }>();
  const deps: PreflightInputDependencies = {
    loadConfig: async () => {
      events.push('config');
      return { config: { ignore: [] }, source: null };
    },
    scanRepository: async () => {
      events.push('scan:start');
      const result = await scan.promise;
      events.push('scan:end');
      return {
        rootPath: '/repo',
        totalFiles: result.files.length,
        totalDirectories: 0,
        files: result.files,
        directoryTree: {
          name: 'repo',
          path: '.',
          children: [],
          fileCount: 0,
          totalFileCount: result.files.length,
        },
        scanDurationMs: 0,
        scanBoundary: {
          source: 'glob',
          gitignoreRespected: false,
          includeIgnored: false,
          ignoredFileCount: 0,
        },
      };
    },
    collectIssues: async () => {
      events.push('issues');
      return [];
    },
    applyConfigToIssues: (issues) => issues,
    calculateScore: () => ({ score: 100, grade: 'A', errors: 0, warnings: 0, infos: 0 }),
    safeChangedFiles: async () => {
      events.push('changed-files');
      return { available: false, count: 0, files: [], baseRef: null };
    },
    safeSession: async () => {
      events.push('session');
      return { id: 'test-session', touchedFiles: [], eventCount: 0 };
    },
    safeHotspots: async () => {
      events.push('hotspots');
      return null;
    },
    safeReviewEvidence: async () => {
      events.push('review:start');
      const result = await review.promise;
      events.push('review:end');
      return result;
    },
    safeCoordination: async () => {
      events.push('coordination');
      return null;
    },
  };

  const task = loadPreflightInputsWithDeps('/repo', 'before_commit', {}, deps);
  await flushPromises();

  expect(events).toEqual(
    expect.arrayContaining(['changed-files', 'session', 'review:start', 'scan:start']),
  );
  expect(events).not.toContain('issues');
  expect(events).not.toContain('coordination');

  scan.resolve({ files: [] });
  await flushPromises();

  expect(events).toContain('issues');
  expect(events).toContain('hotspots');
  expect(events).not.toContain('coordination');

  review.resolve({ available: false, reason: 'review finished' });
  const inputs = await task;

  expect(events.indexOf('review:end')).toBeLessThan(events.indexOf('coordination'));
  expect(inputs.review.reason).toBe('review finished');
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
