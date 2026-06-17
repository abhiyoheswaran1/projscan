import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import type { PreflightMode, PreflightReason, PreflightReport } from '../../src/types.js';
import {
  computePreflight,
  decidePreflightVerdict,
  summarizePreflight,
} from '../../src/core/preflight.js';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';

const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('preflight contract supports the three agent modes', () => {
  const modes: PreflightMode[] = ['before_edit', 'before_commit', 'before_merge'];

  expect(modes).toEqual(['before_edit', 'before_commit', 'before_merge']);
});

test('preflight verdict escalates from reasons', () => {
  const warning: PreflightReason = {
    severity: 'warning',
    source: 'doctor',
    message: 'warning',
  };
  const error: PreflightReason = {
    severity: 'error',
    source: 'review',
    message: 'error',
  };

  expect(decidePreflightVerdict([])).toBe('proceed');
  expect(decidePreflightVerdict([warning])).toBe('caution');
  expect(decidePreflightVerdict([warning, error])).toBe('block');
});

test('preflight summary is compact and agent-ready', () => {
  const report: PreflightReport = {
    schemaVersion: 1,
    mode: 'before_edit',
    verdict: 'proceed',
    summary: '',
    reasons: [],
    evidence: {},
    requiredChecks: [],
    suggestedNextActions: [],
    toolCalls: [],
  };

  expect(summarizePreflight(report)).toBe('proceed: no blocking or cautionary signals found');
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

test('preflight surfaces swarm-coordination evidence and a caution (not block) across worktrees', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-coord-'));
  tempRoots.push(root);
  const sibling = `${root}-wt`;
  tempRoots.push(sibling);
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 't@t.t'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: root });
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-qm', 'base'], { cwd: root });
  await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'agent-b', sibling], { cwd: root });
  // Same-file collision: both worktrees change src/a.ts.
  await fs.writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 2;\n');
  await fs.writeFile(path.join(sibling, 'src', 'a.ts'), 'export const a = 3;\n');
  await execFileAsync('git', ['commit', '-qam', 'b'], { cwd: sibling });

  const report = await computePreflight(root, { mode: 'before_commit' });

  expect(report.evidence.coordination?.available).toBe(true);
  expect(report.evidence.coordination?.readiness).toBe('conflicted');
  expect(report.evidence.coordination?.collisions.high).toBeGreaterThanOrEqual(1);
  const coordReason = report.reasons.find((r) => r.source === 'coordination');
  expect(coordReason).toBeDefined();
  // Advisory only — coordination contributes a warning (caution), never an error/block.
  expect(coordReason?.severity).toBe('warning');

  await execFileAsync('git', ['worktree', 'remove', '--force', sibling], { cwd: root }).catch(
    () => {},
  );
});
