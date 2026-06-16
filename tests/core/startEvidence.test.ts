import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import {
  buildStartCoordinationHints,
  buildStartRiskSources,
} from '../../src/core/startEvidence.js';
import type { SessionCoordinationHint, StartReport } from '../../src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-start-evidence-'));
  tempRoots.push(root);
  return root;
}

describe('start evidence helpers', () => {
  test('builds risk sources from current worktree and remembered session touches', async () => {
    const root = await makeTempRoot();
    const { session } = await loadSession(root);
    recordTouch(session, 'src/index.ts', 'explicit');
    await saveSession(root, session);

    const riskSources = await buildStartRiskSources(root);

    expect(riskSources.currentWorktree.kind).toBe('current-worktree');
    expect(riskSources.currentWorktree.files.length).toBeLessThanOrEqual(40);
    expect(riskSources.sessionMemory).toEqual(
      expect.objectContaining({
        kind: 'remembered-session',
        touchedFiles: ['src/index.ts'],
        totalTouchedFiles: 1,
      }),
    );
    expect(riskSources.sessionMemory.note).toContain('Remembered session context');
  });

  test('sorts and truncates remembered touches while preserving current-worktree fallback shape', async () => {
    const root = await makeTempRoot();
    const { session } = await loadSession(root);
    const tiedTimestamp = '2026-06-16T00:00:00.000Z';
    for (let index = 0; index < 42; index += 1) {
      const file = `src/file-${String(index).padStart(2, '0')}.ts`;
      session.touchedFiles[file] = {
        file,
        source: 'explicit',
        lastTouchedAt: tiedTimestamp,
        count: 1,
      };
    }
    session.touchedFiles['src/latest.ts'] = {
      file: 'src/latest.ts',
      source: 'explicit',
      lastTouchedAt: '2026-06-16T00:01:00.000Z',
      count: 1,
    };
    await saveSession(root, session);

    const riskSources = await buildStartRiskSources(root);

    expect(riskSources.currentWorktree).toEqual(
      expect.objectContaining({
        kind: 'current-worktree',
        available: false,
        count: 0,
        files: [],
        baseRef: null,
      }),
    );
    expect(riskSources.currentWorktree.reason).toBeDefined();
    expect(riskSources.sessionMemory.touchedFiles).toHaveLength(40);
    expect(riskSources.sessionMemory.touchedFiles[0]).toBe('src/latest.ts');
    expect(riskSources.sessionMemory.touchedFiles[1]).toBe('src/file-00.ts');
    expect(riskSources.sessionMemory.touchedFiles).not.toContain('src/file-39.ts');
    expect(riskSources.sessionMemory.totalTouchedFiles).toBe(43);
    expect(riskSources.sessionMemory.truncated).toBe(true);
  });

  test('builds coordination hints with harness pass-through and remembered-session omission or presence', () => {
    const baseRiskSources: StartReport['evidence']['riskSources'] = {
      currentWorktree: {
        kind: 'current-worktree',
        available: true,
        count: 2,
        files: ['src/a.ts', 'src/b.ts'],
        baseRef: 'main',
      },
      sessionMemory: {
        kind: 'remembered-session',
        touchedFiles: [],
        totalTouchedFiles: 0,
        note: 'No remembered touches.',
      },
    };
    const harnessHint: SessionCoordinationHint = {
      id: 'agentloop-task-contract',
      label: 'Start with the AgentLoop task contract',
      message: 'Use the task contract.',
      command: 'npm exec agentloop -- status',
    };

    const withoutSessionMemory = buildStartCoordinationHints(baseRiskSources, 'before_commit', [
      harnessHint,
    ]);

    expect(withoutSessionMemory.map((hint) => hint.id)).toEqual([
      'current-worktree-check',
      'agentloop-task-contract',
    ]);
    expect(withoutSessionMemory[0]).toEqual({
      id: 'current-worktree-check',
      label: 'Separate current worktree evidence from session memory',
      message:
        'Current worktree evidence sees 2 changed file(s); remembered session context may include older agent touches.',
      command: 'projscan preflight --mode before_commit --format json',
    });

    const withSessionMemory = buildStartCoordinationHints(
      {
        ...baseRiskSources,
        sessionMemory: {
          ...baseRiskSources.sessionMemory,
          touchedFiles: ['src/index.ts'],
          totalTouchedFiles: 1,
        },
      },
      'before_edit',
      [harnessHint],
    );

    expect(withSessionMemory.map((hint) => hint.id)).toEqual([
      'current-worktree-check',
      'agentloop-task-contract',
      'remembered-session-context',
    ]);
    expect(withSessionMemory.find((hint) => hint.id === 'remembered-session-context')).toEqual({
      id: 'remembered-session-context',
      label: 'Review remembered session touches',
      message:
        '1 touched file(s) come from remembered session context, not necessarily the current Git diff.',
      command: 'projscan session touched --format json',
    });
  });
});
