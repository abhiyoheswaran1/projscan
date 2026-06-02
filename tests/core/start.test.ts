import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { computeStartReport } from '../../src/core/start.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('start report gives a compact first-60-seconds workflow without mutating the repo', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    maxTasks: 3,
    maxRisks: 4,
    includeHandoff: true,
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as { version: string };
  expect(pkg.version).toBe('0.0.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.mode).toBe('before_edit');
  expect(report.summary).toContain('start');
  expect(report.setup.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(
    expect.arrayContaining(['node', 'package-json', 'git', 'projscan-config', 'plugins', 'mcp-startup']),
  );
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.recommendedWorkflow.commands).toContain('projscan preflight --mode before_edit --format json');
  expect(report.evidence.workplanVerdict).toMatch(/proceed|caution|block/);
  expect(report.evidence.qualityVerdict).toMatch(/excellent|healthy|needs_attention|blocked/);
  expect(report.topRisks.length).toBeGreaterThan(0);
  expect(report.adoptionLoop?.cadence).toBe('every_pr');
  expect(report.adoptionLoop?.metrics.map((metric) => metric.id)).toEqual(
    expect.arrayContaining(['first_pr_useful', 'manual_review_rate', 'repeat_use_commands', 'market_validation_feedback']),
  );
  expect(report.adoptionLoop?.nextCommands).toContain('projscan evidence-pack --pr-comment');
  expect(report.adoptionLoop?.nextCommands).toContain('projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json');
  expect(report.nextActions.length).toBeGreaterThan(0);
  expect(report.handoff?.next.length).toBeGreaterThan(0);
});

test('start report recommends the bug-hunt recipe for bug_hunt mode', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { mode: 'bug_hunt', maxTasks: 2 });

  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.recommendedWorkflow.name).toBe('Bug Hunt');
  expect(report.recommendedWorkflow.mcpTools).toContain('projscan_bug_hunt');
});

test('start report separates current worktree context from remembered session context', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeStartReport(root, { mode: 'before_edit', maxTasks: 2 });

  expect(report.evidence.riskSources.currentWorktree.kind).toBe('current-worktree');
  expect(report.evidence.riskSources.sessionMemory).toEqual(
    expect.objectContaining({
      kind: 'remembered-session',
      touchedFiles: expect.arrayContaining(['src/index.ts']),
      totalTouchedFiles: 1,
    }),
  );
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-start-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
