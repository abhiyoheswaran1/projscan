import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { buildWorkplanHandoff, computeWorkplan } from '../../src/core/workplan.js';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import type { FileHotspot } from '../../src/types/hotspots.js';
import type { WorkplanMode, WorkplanPriority } from '../../src/types.js';

const hotspotState = vi.hoisted(() => ({
  hotspots: [] as FileHotspot[],
}));

vi.mock('../../src/core/hotspotAnalyzer.js', () => ({
  analyzeHotspots: vi.fn(async () => ({
    available: true,
    window: { since: null, commitsScanned: 0 },
    hotspots: hotspotState.hotspots,
    totalFilesRanked: hotspotState.hotspots.length,
  })),
}));

const tempRoots: string[] = [];

afterEach(async () => {
  hotspotState.hotspots = [];
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('workplan contract supports agent mission modes', () => {
  const modes: WorkplanMode[] = [
    'before_edit',
    'before_commit',
    'before_merge',
    'refactor',
    'release',
    'bug_hunt',
    'hardening',
  ];

  expect(modes).toEqual([
    'before_edit',
    'before_commit',
    'before_merge',
    'refactor',
    'release',
    'bug_hunt',
    'hardening',
  ]);
});

test('hardening workplan turns blocking supply-chain evidence into the first p0 task', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    dependencies: {
      '@tanstack/react-router': '1.169.5',
    },
  });

  const report = await computeWorkplan(root, { mode: 'hardening' });

  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('hardening');
  expect(report.verdict).toBe('block');
  expect(report.summary).toContain('block');
  expect(report.tasks[0]).toEqual(
    expect.objectContaining({
      id: 'wp-supply-chain-1',
      priority: 'p0',
      title: expect.stringContaining('supply-chain'),
      suggestedTools: expect.arrayContaining(['projscan_doctor', 'projscan_preflight']),
    }),
  );
  expect(report.tasks[0]?.verification.commands).toContain('projscan preflight --format json');
  expect(report.tasks.some((task) => task.suggestedTools.includes('projscan_semantic_graph'))).toBe(
    true,
  );
  expect(report.topRisks[0]).toEqual(
    expect.objectContaining({ source: 'supply-chain', severity: 'error' }),
  );
});

test('bug_hunt workplan includes evidence, verification, and short handoff text for each task', async () => {
  const root = await makeTempProject();

  const report = await computeWorkplan(root, { mode: 'bug_hunt', maxTasks: 4 });

  expect(report.mode).toBe('bug_hunt');
  expect(report.tasks.length).toBeGreaterThan(0);
  expect(report.tasks.length).toBeLessThanOrEqual(4);
  expect(report.topRisks).toEqual([]);
  expect(report.summary).toContain('no top risks');
  for (const task of report.tasks) {
    expect(['p0', 'p1', 'p2']).toContain(task.priority satisfies WorkplanPriority);
    expect(task.why.length).toBeGreaterThan(10);
    expect(task.evidence.length).toBeGreaterThan(0);
    expect(task.verification.commands.length).toBeGreaterThan(0);
    expect(task.verification.expected.length).toBeGreaterThan(10);
    expect(task.handoffText.length).toBeLessThanOrEqual(320);
  }
});

test('bug_hunt workplan suggested actions use commands that match their tools', async () => {
  const root = await makeTempProject();

  const report = await computeWorkplan(root, { mode: 'bug_hunt', maxTasks: 1 });

  expect(report.tasks[0]?.suggestedTools).toContain('projscan_file');
  expect(report.suggestedNextActions.every((action) => action.command)).toBe(true);
  expect(report.suggestedNextActions.map((action) => action.tool)).not.toContain('projscan_file');
  expect(report.suggestedNextActions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: 'Use projscan_hotspots for Hunt bugs in the highest-risk files',
        tool: 'projscan_hotspots',
        command: 'projscan hotspots --format json',
      }),
      expect.objectContaining({
        label: 'Use projscan_doctor for Hunt bugs in the highest-risk files',
        tool: 'projscan_doctor',
        command: 'projscan doctor --format json',
      }),
    ]),
  );
});

test('bug_hunt workplan names ranked hotspot files when no session files are touched', async () => {
  hotspotState.hotspots = [
    hotspot({ relativePath: 'tests/tiny.test.ts', lineCount: 40, riskScore: 300 }),
    hotspot({ relativePath: 'src/large.ts', lineCount: 450, riskScore: 100 }),
    hotspot({ relativePath: 'src/complex.ts', cyclomaticComplexity: 18, riskScore: 90 }),
  ];
  const root = await makeTempProject();

  const report = await computeWorkplan(root, { mode: 'bug_hunt', maxTasks: 2 });
  const hotspotTask = report.tasks.find((task) => task.id === 'wp-bug-hunt-hotspots');

  expect(report.topRisks.slice(0, 2)).toEqual([
    expect.objectContaining({
      source: 'hotspots',
      file: 'src/large.ts',
      priority: 'p1',
    }),
    expect.objectContaining({
      source: 'hotspots',
      file: 'src/complex.ts',
      priority: 'p1',
    }),
  ]);
  expect(hotspotTask?.files.slice(0, 2)).toEqual(['src/large.ts', 'src/complex.ts']);
  expect(hotspotTask?.evidence).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'hotspots',
        file: 'src/large.ts',
        message: 'Hotspot src/large.ts',
      }),
    ]),
  );
  expect(report.fixFirst?.files.slice(0, 2)).toEqual(['src/large.ts', 'src/complex.ts']);
  expect(report.fixFirst?.priority).toBe('p1');
  expect(report.fixFirst?.whyFirst).toContain('review signal');
  expect(report.fixFirst?.whyFirst).not.toContain('blocking signal');
  expect(report.summary).toContain('top risk');
  expect(report.summary).not.toContain('no top risks');
});

test('bug_hunt workplan emits shell-safe file suggested actions', async () => {
  hotspotState.hotspots = [
    hotspot({
      relativePath: 'src/app route/$(touch pwn).ts',
      lineCount: 450,
      riskScore: 100,
    }),
  ];
  const root = await makeTempProject();

  const report = await computeWorkplan(root, { mode: 'bug_hunt', maxTasks: 2 });
  const fileAction = report.suggestedNextActions.find((action) => action.tool === 'projscan_file');

  expect(fileAction?.command).toBe(
    'projscan file "src/app route/\\$(touch pwn).ts" --format json',
  );
});

test('release workplan includes release check and local website prompt without mutating version', async () => {
  const root = await makeTempProject();

  const report = await computeWorkplan(root, { mode: 'release' });

  expect(report.mode).toBe('release');
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining(['wp-release-readiness', 'wp-release-website']),
  );
  expect(
    report.tasks.find((task) => task.id === 'wp-release-readiness')?.verification.commands,
  ).toContain('npm run release:check');
  const websiteTask = report.tasks.find((task) => task.id === 'wp-release-website');
  expect(websiteTask?.suggestedTools).toContain('projscan_evidence_pack');
  expect(websiteTask?.verification.commands).toContain(
    'projscan evidence-pack --website-prompt --format json',
  );
  expect(websiteTask?.verification.commands).not.toContain('npm view projscan version');
  expect(websiteTask?.verification.commands).not.toContain('gh release view vX.Y.Z --json assets');
});

test('workplan carries touched-file coordination into the handoff', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeWorkplan(root, { mode: 'before_edit' });

  expect(report.coordination.touchedFiles).toEqual(['src/index.ts']);
  expect(report.coordination.recommendedNextAgent).toContain('preflight');
  expect(report.tasks.some((task) => task.handoffText.includes('src/index.ts'))).toBe(true);
});

test('workplan routes touched files to CODEOWNERS owners', async () => {
  const root = await makeTempProject();
  await fs.mkdir(path.join(root, '.github'), { recursive: true });
  await fs.writeFile(path.join(root, '.github', 'CODEOWNERS'), 'src/** @platform-team\n');
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeWorkplan(root, { mode: 'before_edit' });
  const task = report.tasks.find((entry) => entry.id === 'wp-session-handoff');

  expect(task?.owner).toBe('@platform-team');
  expect(task?.handoffText).toContain('@platform-team');
});

test('workplan handoff payload is reusable and includes verification commands', async () => {
  const root = await makeTempProject();

  const report = await computeWorkplan(root, { mode: 'before_edit', maxTasks: 3 });
  const handoff = buildWorkplanHandoff(report);

  expect(handoff.summary).toBe(report.summary);
  expect(handoff.verdict).toBe(report.verdict);
  expect(handoff.next.length).toBeGreaterThan(0);
  expect(handoff.verificationCommands).toEqual(
    expect.arrayContaining(['projscan preflight --mode before_edit --format json']),
  );
  expect(handoff.markdown).toContain('## Next');
  expect(handoff.markdown).toContain('projscan preflight --mode before_edit --format json');
  expect(handoff.markdown).not.toContain('projscan preflight --format json');
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-workplan-'));
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

function hotspot(overrides: Partial<FileHotspot>): FileHotspot {
  return {
    relativePath: 'src/file.ts',
    churn: 80,
    distinctAuthors: 1,
    daysSinceLastChange: 0,
    lineCount: 50,
    cyclomaticComplexity: 1,
    sizeBytes: 1000,
    issueCount: 0,
    issueIds: [],
    riskScore: 182.7,
    reasons: ['high churn'],
    primaryAuthor: 'dev@example.com',
    primaryAuthorShare: 1,
    busFactorOne: true,
    topAuthors: [{ author: 'dev@example.com', commits: 80, share: 1 }],
    coverage: null,
    ...overrides,
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
