import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computePreflight } from '../../src/core/preflight.js';
import { buildPreflightReport } from '../../src/core/preflightReport.js';
import type { PreflightInputs } from '../../src/core/preflightInputs.js';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('before_edit works outside git and returns a complete report', async () => {
  const root = await makeTempProject();

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('before_edit');
  expect(['proceed', 'caution', 'block']).toContain(report.verdict);
  expect(report.summary).toContain(report.verdict);
  expect(report.evidence.changedFiles?.available).toBe(false);
});

test('preflight truncates large session evidence for agent-sized output', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  for (let i = 0; i < 75; i += 1) {
    recordTouch(session, `src/file-${i}.ts`, 'explicit');
  }
  await saveSession(root, session);

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.truncated).toBe(true);
  expect(report.evidence.session?.touchedFiles.length).toBeLessThanOrEqual(40);
  expect(report.evidence.session?.totalTouchedFiles).toBe(75);
});

test('preflight session evidence prefers most recent touched files', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/a-old.ts', 'explicit');
  recordTouch(session, 'src/z-new.ts', 'explicit');
  session.touchedFiles['src/a-old.ts'].lastTouchedAt = '2026-05-18T10:00:00.000Z';
  session.touchedFiles['src/z-new.ts'].lastTouchedAt = '2026-05-18T10:01:00.000Z';
  await saveSession(root, session);

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.evidence.session?.touchedFiles.slice(0, 2)).toEqual([
    'src/z-new.ts',
    'src/a-old.ts',
  ]);
});

test('preflight separates current worktree evidence from remembered session context', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.evidence.riskSources?.currentWorktree).toEqual(
    expect.objectContaining({
      kind: 'current-worktree',
      available: false,
      count: 0,
      reason: 'changed-file detection is not required before edits',
    }),
  );
  expect(report.evidence.riskSources?.sessionMemory).toEqual(
    expect.objectContaining({
      kind: 'remembered-session',
      touchedFiles: ['src/index.ts'],
      totalTouchedFiles: 1,
      note: expect.stringContaining('remembered'),
    }),
  );
  expect(report.evidence.session?.kind).toBe('remembered-session');
});

test('preflight collapses release-scale-only manual signoff into one reason', () => {
  const changedFiles = Array.from({ length: 51 }, (_, index) => `src/file-${index}.ts`);
  const reviewSummary =
    'Maximum changed-file risk score exceeds review threshold. Manual release sign-off recommended.';

  const report = buildPreflightReport({
    mode: 'before_merge',
    maxChangedFiles: 50,
    inputs: {
      issues: [],
      health: { score: 100, grade: 'A', errors: 0, warnings: 0, infos: 0 },
      changedFiles: {
        available: true,
        count: changedFiles.length,
        files: changedFiles,
        baseRef: 'origin/main',
      },
      session: { id: 'test-session', touchedFiles: [], eventCount: 0 },
      hotspots: null,
      review: {
        available: true,
        verdict: 'block',
        summary: reviewSummary,
        newTaintFlows: 0,
        newDataflowRisks: 0,
      },
      coordination: null,
    } satisfies PreflightInputs,
  });

  expect(report.verdict).toBe('caution');
  expect(report.reasons).toEqual([
    expect.objectContaining({
      severity: 'warning',
      source: 'release',
      message: expect.stringContaining('Large platform release risk'),
    }),
  ]);
  expect(report.evidence.changedFiles?.count).toBe(51);
  expect(report.evidence.review).toEqual(
    expect.objectContaining({ available: true, verdict: 'block', summary: reviewSummary }),
  );
  expect(report.evidence.releaseScale).toEqual(
    expect.objectContaining({
      detected: true,
      changedFiles: 51,
      threshold: 50,
      reviewVerdict: 'block',
      reviewSummary,
    }),
  );
  expect(report.suggestedNextActions).toEqual([
    expect.objectContaining({
      label: 'Inspect the full review before continuing',
      command: 'projscan review --format json',
    }),
  ]);
  expect(report.cautionBudget).toEqual(
    expect.objectContaining({
      primary: expect.objectContaining({
        source: 'release',
        action: 'manual_signoff',
      }),
      reviewOnly: [],
      fixNow: [],
      manualSignoff: [
        expect.objectContaining({
          source: 'release',
          action: 'manual_signoff',
        }),
      ],
    }),
  );
});

test('preflight keeps separate review blocks visible during release-scale signoff', () => {
  const changedFiles = Array.from({ length: 51 }, (_, index) => `src/file-${index}.ts`);
  const reviewSummary =
    'Maximum changed-file risk score is 120.0 (>= 80).; 1 new import cycle(s) introduced.';

  const report = buildPreflightReport({
    mode: 'before_merge',
    maxChangedFiles: 50,
    inputs: {
      issues: [],
      health: { score: 100, grade: 'A', errors: 0, warnings: 0, infos: 0 },
      changedFiles: {
        available: true,
        count: changedFiles.length,
        files: changedFiles,
        baseRef: 'origin/main',
      },
      session: { id: 'test-session', touchedFiles: [], eventCount: 0 },
      hotspots: null,
      review: {
        available: true,
        verdict: 'block',
        summary: reviewSummary,
        newTaintFlows: 0,
        newDataflowRisks: 0,
      },
      coordination: null,
    } satisfies PreflightInputs,
  });

  expect(report.verdict).toBe('caution');
  expect(report.reasons.map((reason) => reason.source)).toEqual(['release', 'review']);
  expect(report.reasons[0]?.message).toContain('separate review block');
  expect(report.reasons[0]?.message).not.toContain(
    'Review blocks on scale/complexity rather than new taint',
  );
  expect(report.reasons[1]).toEqual(
    expect.objectContaining({
      severity: 'warning',
      source: 'review',
      message: expect.stringContaining(reviewSummary),
    }),
  );
  expect(report.cautionBudget).toEqual(
    expect.objectContaining({
      primary: expect.objectContaining({
        source: 'review',
        action: 'fix_now',
      }),
      reviewOnly: [
        expect.objectContaining({
          source: 'release',
          action: 'manual_signoff',
        }),
      ],
      fixNow: [
        expect.objectContaining({
          source: 'review',
          action: 'fix_now',
        }),
      ],
      manualSignoff: [
        expect.objectContaining({
          source: 'release',
          action: 'manual_signoff',
        }),
      ],
    }),
  );
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
