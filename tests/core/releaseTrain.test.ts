import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeReleaseTrain } from '../../src/core/releaseTrain.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('release train plans 2.3.x and 2.4.x without changing package metadata', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeReleaseTrain(root, {
    lines: ['2.3.x', '2.4.x'],
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as {
    version: string;
  };
  expect(pkg.version).toBe('2.2.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.currentVersion).toBe('2.2.0');
  expect(report.plan.readOnly).toBe(true);
  expect(report.plan.policy).toBe('product-readiness-plan');
  expect(report.plan.lines).toEqual(['2.3.x', '2.4.x']);
  expect(report.tracks.map((track) => track.line)).toEqual(['2.3.x', '2.4.x']);
  expect(report.tracks[0]?.theme).toContain('Mission Control');
  expect(report.tracks[1]?.theme).toContain('Bug Hunt');
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining(['rt-2-3-agent-readiness', 'rt-2-4-bug-hunt-gate', 'rt-plan-readiness']),
  );
});

test('release train defaults to the six-line product plan', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeReleaseTrain(root);

  expect(report.plan.lines).toEqual(['2.3.x', '2.4.x', '2.5.x', '2.6.x', '2.7.x', '2.8.x']);
  expect(report.tracks.map((track) => track.theme)).toEqual(
    expect.arrayContaining([
      'Agent Mission Control',
      'Autonomous Bug Hunt',
      'Release Evidence Pack',
      'Regression Planning',
      'Agent Brief',
      'Quality Scorecard',
    ]),
  );
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining([
      'rt-2-5-evidence-pack',
      'rt-2-6-regression-plan',
      'rt-2-7-agent-brief',
      'rt-2-8-quality-scorecard',
    ]),
  );
});

test('release train describes bug-hunt proof as prioritized actions, not only fix targets', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeReleaseTrain(root, { lines: ['2.4.x'] });
  const bugHuntTrack = report.tracks[0];
  const planningText = [
    bugHuntTrack?.outcome,
    ...(bugHuntTrack?.scope ?? []),
    ...(bugHuntTrack?.successCriteria ?? []),
  ].join('\n');

  expect(bugHuntTrack?.successCriteria).toContain(
    'bug-hunt output names the first prioritized action and commands to prove it',
  );
  expect(planningText).toContain('ranked action queue');
  expect(planningText).not.toContain('fix queue');
  expect(planningText).not.toContain('first fix target');
});

test('release train plans 3.x graph platform lines', async () => {
  const root = await makeTempProject('3.0.1');

  const report = await computeReleaseTrain(root, {
    lines: ['3.0.x', '3.1.x'],
  });

  expect(report.plan.lines).toEqual(['3.0.x', '3.1.x']);
  expect(report.tracks.map((track) => track.theme)).toEqual([
    'Graph Operations Readiness',
    'Graph Intelligence Expansion',
  ]);
  expect(report.tracks[0]?.scope).toEqual(
    expect.arrayContaining([
      'graph corpus release gate',
      'dataflow precision hardening',
      'ownership-aware impact',
    ]),
  );
  expect(report.tracks[1]?.scope).toEqual(
    expect.arrayContaining([
      'package-scoped review evidence',
      'framework route dataflow precision',
    ]),
  );
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining([
      'rt-3-0-graph-readiness',
      'rt-3-1-graph-expansion',
      'rt-plan-readiness',
    ]),
  );
});

test('release train defaults to the eight-item 3.2 roadmap train for 3.1 and newer', async () => {
  const root = await makeTempProject('3.1.0');

  const report = await computeReleaseTrain(root);

  expect(report.plan.lines).toEqual([
    '3.2.x',
    '3.3.x',
    '3.4.x',
    '3.5.x',
    '3.6.x',
    '3.7.x',
    '3.8.x',
    '3.9.x',
  ]);
  expect(report.tracks.map((track) => track.theme)).toEqual([
    'Roadmap Canonicalization',
    'Adoption Proof Polish',
    'Repo Understanding',
    'Plugin Trust',
    'Swarm Collision Detection',
    'Claims And Leases',
    'Merge-Risk Preflight',
    'Agent Ergonomics And Coordination Proof',
  ]);
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining([
      'rt-3-2-roadmap-canonicalization',
      'rt-3-3-adoption-proof-polish',
      'rt-3-4-repo-understanding',
      'rt-3-5-plugin-trust',
      'rt-3-6-collision-detection',
      'rt-3-7-claims-leases',
      'rt-3-8-merge-risk-preflight',
      'rt-3-9-agent-ergonomics-and-proof',
    ]),
  );
  expect(report.tasks.find((task) => task.id === 'rt-3-6-collision-detection')?.files).toEqual(
    expect.arrayContaining(['src/core/collisionDetector.ts', 'src/mcp/tools/collision.ts']),
  );
});

test('release train defaults to repo understanding for 3.4 through 4.3 versions', async () => {
  const root = await makeTempProject('3.4.0');

  const report = await computeReleaseTrain(root);

  expect(report.plan.lines).toEqual(['3.4.x']);
  expect(report.tracks.map((track) => track.theme)).toEqual(['Repo Understanding']);
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining(['rt-3-4-repo-understanding', 'rt-plan-readiness']),
  );
});

test('release train keeps very large 3.x minors on the 3.x roadmap', async () => {
  const root = await makeTempProject('3.1005.0');

  const report = await computeReleaseTrain(root);

  expect(report.plan.lines).toEqual(['3.4.x']);
});

test('release train defaults to the post-4.4 product plan for 4.4 and newer', async () => {
  const root = await makeTempProject('4.4.0');

  const report = await computeReleaseTrain(root);

  expect(report.plan.lines).toEqual(['4.5.x', '4.6.x', '4.7.x', '4.8.x', '4.9.x']);
  expect(report.tracks.map((track) => track.theme)).toEqual([
    'Roadmap And Release-Train Reliability',
    'Swarm Coordination Evidence',
    'Framework Dataflow Precision',
    'Scoped Evidence Exports',
    'Python Upgrade Intelligence And Hotspot Maintainability',
  ]);
  expect(report.tasks.map((task) => task.id)).toEqual(
    expect.arrayContaining([
      'rt-4-5-roadmap-release-train-refresh',
      'rt-4-6-swarm-coordination-validation',
      'rt-4-7-framework-dataflow-precision',
      'rt-4-8-scoped-redacted-evidence',
      'rt-4-9-python-upgrade-and-hotspot-maintainability',
      'rt-plan-readiness',
    ]),
  );
  expect(report.tasks.find((task) => task.id === 'rt-4-8-scoped-redacted-evidence')?.files).toEqual(
    expect.arrayContaining(['src/core/reportScope.ts', 'src/reporters/sarifReporter.ts']),
  );
});

test('release train marks blockers when preflight blocks', async () => {
  const root = await makeTempProject('2.2.0');
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '2.2.0',
    type: 'module',
    dependencies: {
      '@tanstack/react-router': '1.169.5',
    },
  });

  const report = await computeReleaseTrain(root);

  expect(report.readiness.verdict).toBe('block');
  expect(report.readiness.blockers).toBeGreaterThan(0);
  expect(report.tasks[0]).toEqual(
    expect.objectContaining({
      priority: 'p0',
      id: 'rt-blockers-first',
    }),
  );
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-release-train-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), { name: 'fixture', version, type: 'module' });
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
