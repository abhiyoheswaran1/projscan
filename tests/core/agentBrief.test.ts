import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import type { CoordinationSummary } from '../../src/core/coordination.js';
import { computeAgentBrief } from '../../src/core/agentBrief.js';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';

const tempRoots: string[] = [];
const computeCoordinationMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/core/coordination.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/coordination.js')>();
  return {
    ...actual,
    computeCoordination: computeCoordinationMock,
  };
});

afterEach(async () => {
  computeCoordinationMock.mockReset();
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('agent brief returns compact next-agent context without mutating package version', async () => {
  const root = await makeTempProject('2.2.0');
  await fs.writeFile(path.join(root, 'src', 'danger.ts'), 'eval("console.log(1)");\n');

  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeAgentBrief(root, { intent: 'bug_hunt', maxItems: 4 });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as {
    version: string;
  };
  expect(pkg.version).toBe('2.2.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.intent).toBe('bug_hunt');
  expect(report.summary).toContain('agent brief');
  expect(report.focus.length).toBeGreaterThan(0);
  expect(report.focus.length).toBeLessThanOrEqual(4);
  expect(report.guardrails.map((guardrail) => guardrail.command)).toEqual(
    expect.arrayContaining([
      'projscan doctor --format json',
      'projscan preflight --mode before_edit --format json',
    ]),
  );
  expect(report.context.totalFiles).toBeGreaterThan(0);
  expect(report.context.coordinationHints.map((hint) => hint.id)).toContain(
    'remembered-session-context',
  );
  expect(report.context.coordinationHints.map((hint) => hint.command)).toContain(
    'projscan session touched --format json',
  );
  expect(report.context.graph).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      totalFunctions: expect.any(Number),
      totalCallEdges: expect.any(Number),
      dataflowRisks: expect.any(Number),
    }),
  );
  expect(report.suggestedNextActions.length).toBeGreaterThan(0);
});

test('agent brief carries swarm coordination evidence boundaries for the next agent', async () => {
  const root = await makeTempProject('2.2.0');
  computeCoordinationMock.mockResolvedValue(clearMultiWorktreeCoordination(root));

  const report = await computeAgentBrief(root, { maxItems: 4 });

  const hint = report.context.coordinationHints.find((entry) => entry.id === 'swarm-coordination');
  expect(hint).toEqual(
    expect.objectContaining({
      label: 'Swarm coordination',
      command: 'projscan coordinate --format json',
    }),
  );
  expect(hint?.message).toContain(
    '`projscan coordinate` local-only evidence sees current worktree main with 2 changed file(s) against origin/main and 0 uncommitted file(s)',
  );
  expect(hint?.message).toContain('Merge agent-a first (lowest risk). Validate locally');
  expect(hint?.message).toContain('`projscan coordinate --watch --interval 5 --format json`');
  expect(hint?.message).toContain('Remembered session context is read separately');
  expect(hint?.message).toContain('projscan agent-brief --format json');
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-agent-brief-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version, type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

function clearMultiWorktreeCoordination(root: string): CoordinationSummary {
  return {
    schemaVersion: 1,
    available: true,
    worktreeCount: 2,
    collisions: { total: 0, high: 0, medium: 0 },
    claims: { total: 0, contendedTargets: 0 },
    mergeRisk: {
      hotspotCount: 0,
      integrationOrder: [
        { worktree: '/repo/.worktrees/agent-a', branch: 'agent-a', riskScore: 0 },
        { worktree: root, branch: 'main', riskScore: 0 },
      ],
    },
    readiness: 'clear',
    summary: ['2 in-flight worktree(s).', 'No collisions across worktrees.'],
    evidence: {
      commandPath: 'projscan coordinate',
      command: 'projscan coordinate --format json',
      localOnly: true,
      worktreeCount: 2,
      currentWorktree: {
        path: root,
        branch: 'main',
        changedFileCount: 2,
        uncommittedChangedFileCount: 0,
        baseRef: 'origin/main',
      },
      activeSignals: [
        {
          name: 'collisions',
          commandPath: 'projscan collisions',
          source: 'git worktree list, local diffs, and the local import graph',
        },
      ],
      validationWorkflow: [
        {
          command: 'projscan coordinate --format json',
          purpose: 'Read the one-call swarm readiness verdict.',
        },
        {
          command: 'projscan coordinate --watch --interval 5 --format json',
          purpose: 'Watch local coordination state changes while parallel work continues.',
        },
        {
          command: 'projscan agent-brief --format json',
          purpose: 'Carry coordination hints into the next-agent packet without mixing session memory.',
        },
      ],
      sessionSeparation: {
        currentEvidence:
          'Current worktree evidence is read from local git/worktree state during this command.',
        rememberedContext:
          'Remembered session context is read separately through projscan session and agent-brief coordination hints.',
        command: 'projscan agent-brief --format json',
      },
    },
  };
}
