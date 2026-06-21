import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';
import { expectedReviewPromptReplies } from '../helpers/startReviewGate.js';

test('start report keeps adoption gap shaping out of the main orchestrator', () => {
  const startSource = readFileSync(path.join(process.cwd(), 'src/core/start.ts'), 'utf8');
  expect(startSource).not.toContain(".filter((diagnostic) => diagnostic.status !== 'pass')");

  const adoptionGapsSource = readFileSync(
    path.join(process.cwd(), 'src/core/startAdoptionGaps.ts'),
    'utf8',
  );
  expect(adoptionGapsSource).not.toContain("from './start.js'");
});

test('start report keeps final report assembly out of the main orchestrator', () => {
  const startSource = readFileSync(path.join(process.cwd(), 'src/core/start.ts'), 'utf8');
  expect(startSource).not.toContain('schemaVersion: 1');
  expect(startSource).not.toContain('buildWorkplanHandoff');
  expect(startSource).not.toContain('quality.truncated === true');

  const reportSource = readFileSync(
    path.join(process.cwd(), 'src/core/startReportBuilder.ts'),
    'utf8',
  );
  expect(reportSource).toContain('export function buildStartReport');
  expect(reportSource).toContain('schemaVersion: 1');
});

test('start report re-exports options type without duplicating the startOptions import surface', () => {
  const startSource = readFileSync(path.join(process.cwd(), 'src/core/start.ts'), 'utf8');
  expect(startSource).toContain(
    "import { normalizeStartOptions, type ComputeStartOptions } from './startOptions.js';",
  );
  expect(startSource).toContain('export type { ComputeStartOptions };');
  expect(startSource).not.toContain(
    "export type { ComputeStartOptions } from './startOptions.js';",
  );
});

test('start report gives a compact first-60-seconds workflow without mutating the repo', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    maxTasks: 3,
    maxRisks: 4,
    includeHandoff: true,
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as {
    version: string;
  };
  expect(pkg.version).toBe('0.0.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.modeReason).toContain('before_edit');
  expect(report.summary).toContain('start');
  expect(report.setup.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(
    expect.arrayContaining([
      'node',
      'package-json',
      'git',
      'projscan-config',
      'plugins',
      'mcp-startup',
    ]),
  );
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.recommendedWorkflow.commands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(report.firstTenMinutes.commands.slice(0, 3).map((step) => step.command)).toEqual([
    'projscan privacy-check --offline',
    'projscan start --mode before_edit',
    'projscan preflight --mode before_edit --format json',
  ]);
  expect(report.firstTenMinutes.commands.map((step) => step.id)).toContain('first-pr-evidence');
  expect(report.coordinationHints.map((hint) => hint.id)).toContain('current-worktree-check');
  expect(report.coordinationHints[0]?.message).toMatch(
    /^(Current worktree evidence is unavailable|Working tree has)/,
  );
  expect(report.missionControl.status).toMatch(/ready|needs_setup|needs_attention|blocked/);
  expect(report.missionControl.primaryAction.command).toBeDefined();
  expect(report.missionControl.successCriteria.length).toBeGreaterThan(0);
  expect(
    report.missionControl.proofCommands.some((command) =>
      command.startsWith('projscan preflight '),
    ),
  ).toBe(true);
  expect(report.missionControl.handoffPrompt).toContain(
    report.missionControl.primaryAction.command ?? '',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    report.missionControl.successCriteria[0] ?? '',
  );
  expect(report.evidence.workplanVerdict).toMatch(/proceed|caution|block/);
  expect(report.evidence.qualityVerdict).toMatch(/excellent|healthy|needs_attention|blocked/);
  expect(report.topRisks.length).toBeGreaterThan(0);
  expect(report.adoptionLoop?.cadence).toBe('every_pr');
  expect(report.adoptionLoop?.metrics.map((metric) => metric.id)).toEqual(
    expect.arrayContaining([
      'first_pr_useful',
      'manual_review_rate',
      'repeat_use_commands',
      'market_validation_feedback',
    ]),
  );
  expect(report.adoptionLoop?.nextCommands).toContain('projscan evidence-pack --pr-comment');
  expect(report.adoptionLoop?.nextCommands).toContain(
    'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
  );
  expect(report.nextActions.length).toBeGreaterThan(0);
  expect(report.handoff?.next.length).toBeGreaterThan(0);
});

test('start report surfaces a local AgentLoop harness when present', async () => {
  const root = await makeTempProject();
  await fs.writeFile(
    path.join(root, 'AGENTLOOP.md'),
    '# AgentLoopKit\n\nUse npm exec agentloop -- status.\n',
  );

  const report = await computeStartReport(root, {
    mode: 'before_edit',
  });

  expect(report.coordinationHints).toContainEqual(
    expect.objectContaining({
      id: 'agentloop-task-contract',
      label: 'Start with the AgentLoop task contract',
      command: 'npm exec agentloop -- status',
    }),
  );
  expect(
    report.coordinationHints.find((hint) => hint.id === 'agentloop-task-contract')?.message,
  ).toContain('AGENTLOOP.md');
  expect(report.missionControl.guardrails).toContainEqual(
    expect.objectContaining({
      label: 'Start with the AgentLoop task contract',
      command: 'npm exec agentloop -- status',
    }),
  );
  expect(report.missionControl.proofCommands).toContain('npm exec agentloop -- status');
});

test('start report detects AgentLoop config-only harnesses', async () => {
  const root = await makeTempProject();
  await fs.writeFile(path.join(root, 'agentloop.config.json'), '{"version":1}\n');

  const report = await computeStartReport(root, {
    mode: 'before_edit',
  });

  expect(report.coordinationHints).toContainEqual(
    expect.objectContaining({
      id: 'agentloop-task-contract',
      command: 'npm exec agentloop -- status',
    }),
  );
  expect(
    report.coordinationHints.find((hint) => hint.id === 'agentloop-task-contract')?.message,
  ).toContain('agentloop.config.json');
});

test('start report does not add AgentLoop guidance when the harness is absent', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
  });

  expect(report.coordinationHints.map((hint) => hint.id)).not.toContain('agentloop-task-contract');
});

test('start report surfaces a local AgentFlight verification harness when present', async () => {
  const root = await makeTempProject();
  await fs.mkdir(path.join(root, '.agentflight'), { recursive: true });
  await fs.writeFile(path.join(root, '.agentflight', 'config.json'), '{"version":1}\n');

  const report = await computeStartReport(root, {
    mode: 'before_edit',
  });

  expect(report.coordinationHints).toContainEqual(
    expect.objectContaining({
      id: 'agentflight-verification',
      label: 'Run AgentFlight verification evidence',
      command: 'npm exec agentflight -- verify',
    }),
  );
  expect(
    report.coordinationHints.find((hint) => hint.id === 'agentflight-verification')?.message,
  ).toContain('.agentflight/config.json');
  expect(report.missionControl.guardrails).toContainEqual(
    expect.objectContaining({
      label: 'Run AgentFlight verification evidence',
      command: 'npm exec agentflight -- verify',
    }),
  );
  expect(report.missionControl.proofCommands).toContain('npm exec agentflight -- verify');
});

test('start report keeps both AgentLoop and AgentFlight harness commands in proof', async () => {
  const root = await makeTempProject();
  await fs.writeFile(path.join(root, 'AGENTLOOP.md'), '# AgentLoopKit\n');
  await fs.mkdir(path.join(root, '.agentflight'), { recursive: true });
  await fs.writeFile(path.join(root, '.agentflight', 'config.json'), '{"version":1}\n');

  const report = await computeStartReport(root, {
    mode: 'before_edit',
  });

  expect(report.coordinationHints.map((hint) => hint.id)).toEqual([
    'current-worktree-check',
    'agentloop-task-contract',
    'agentflight-verification',
  ]);
  expect(report.missionControl.proofCommands).toEqual(
    expect.arrayContaining(['npm exec agentloop -- status', 'npm exec agentflight -- verify']),
  );
});

test('start report does not add AgentFlight guidance when the verification harness is absent', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
  });

  expect(report.coordinationHints.map((hint) => hint.id)).not.toContain('agentflight-verification');
});

test('start report can resume from a saved mission outcome', async () => {
  const root = await makeTempProject();
  const missionDir = path.join(root, '.projscan', 'mission');
  await fs.mkdir(path.join(missionDir, 'proof-logs'), { recursive: true });
  await fs.writeFile(
    path.join(missionDir, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      kind: 'projscan.mission-bundle',
      mode: 'before_edit',
      status: 'ready',
      currentStep: {
        phaseId: 'ready_now',
        stepId: 'ready-1',
        command: 'projscan search "auth" --format json',
      },
    }) + '\n',
  );
  await fs.writeFile(
    path.join(missionDir, 'proof-logs', 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status: 'passed',
      totalCommands: 2,
      nextAction: 'run ./review.sh and choose a reviewer reply.',
      report: 'proof-logs/run-report.md',
      statusRows: 'proof-logs/status.jsonl',
    }) + '\n',
  );
  await fs.writeFile(
    path.join(missionDir, 'proof-logs', 'status.jsonl'),
    [
      JSON.stringify({
        id: 'current-ready-1',
        label: 'Run current command',
        log: 'current-ready-1.log',
        command: 'projscan search "auth" --format json',
        exitCode: 0,
      }),
      JSON.stringify({
        id: 'proof-1',
        label: 'Proof 1',
        log: 'proof-1.log',
        command: 'projscan preflight --mode before_edit --format json',
        exitCode: 0,
      }),
    ].join('\n') + '\n',
  );

  const report = await computeStartReport(root, {
    intent: 'give the next agent a handoff',
    missionDir: '.projscan/mission',
  });

  expect(report.missionControl.outcome).toEqual(
    expect.objectContaining({
      available: true,
      status: 'passed',
      whatChanged: expect.arrayContaining(['Mission proof passed after 2 command(s).']),
      whatRemains: expect.arrayContaining(['Run ./review.sh and choose a reviewer reply.']),
      versionCandidate: expect.objectContaining({ recommendation: 'review_candidate' }),
    }),
  );
  expect(report.missionControl.resume.prompt).toContain('Mission proof passed');
  expect(report.missionControl.handoffPrompt).toContain('Mission proof passed');
});

test('start report routes a plain-language intent into mission control', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.intent).toBe('what breaks if I rename the auth token loader');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_impact',
      cli: 'projscan impact',
      category: 'Impact',
      confidence: 'high',
      rank: 1,
      score: 2,
      matchedKeywords: ['breaks', 'rename'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
    }),
  );
  expect(report.missionControl.headline).toContain('Find exact target for impact analysis');
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan search "auth token loader" --format json',
    'projscan impact --symbol <symbol-from-search> --format json',
    'projscan impact <file-from-search> --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan search "auth token loader" --format json',
  ]);
  expect(report.missionControl.readyActions[0]?.args).toEqual({ query: 'auth token loader' });
  expect(report.missionControl.actionPlan.map((action) => action.label)).toEqual([
    'Find exact target for impact analysis',
    'If search returns an exported symbol',
    'If search returns a file path',
  ]);
  expect(report.missionControl.actionPlan[0]?.args).toEqual({ query: 'auth token loader' });
  expect(report.missionControl.actionPlan[1]?.args).toEqual({ symbol: '<symbol-from-search>' });
  expect(report.missionControl.actionPlan[2]?.args).toEqual({ file: '<file-from-search>' });
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'symbol',
      placeholder: '<symbol-from-search>',
      sourceAction: 'Find exact target for impact analysis',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    },
    {
      name: 'file',
      placeholder: '<file-from-search>',
      sourceAction: 'Find exact target for impact analysis',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    },
  ]);
  expect(report.missionControl.proofCommands[0]).toBe(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.proofSummary).toBe(
    'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  expect(report.missionControl.proofCommands.some((command) => command.includes('<'))).toBe(false);
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan impact <file-from-search> --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan impact --symbol buildCodeGraph --format json',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Needs input: symbol=<symbol-from-search>, file=<file-from-search>.',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Done when: An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.handoffPrompt).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  for (const reply of expectedReviewPromptReplies) {
    expect(report.missionControl.handoffPrompt).toContain(reply);
  }
  expect(report.missionControl.resume.prompt).not.toContain('Review gate:');
  expect(report.missionControl.handoffPrompt).not.toContain(
    'projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(report.missionControl.handoffPrompt).not.toContain('Next:');
  expect(report.missionControl.handoffPrompt).not.toContain('..');
  expect(report.missionControl.handoff).toEqual(
    expect.objectContaining({
      nextAction: expect.objectContaining({
        command: 'projscan search "auth token loader" --format json',
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
      }),
      readyActions: [
        expect.objectContaining({
          command: 'projscan search "auth token loader" --format json',
          tool: 'projscan_search',
          args: { query: 'auth token loader' },
        }),
      ],
      needsInput: report.missionControl.unresolvedInputs,
      doneWhen: report.missionControl.successCriteria,
      readyProof: {
        summary:
          'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
        commands: report.missionControl.resume.remainingProofCommands,
        toolCalls: report.missionControl.resume.remainingProofToolCalls,
        items: report.missionControl.resume.remainingProofItems,
      },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'An exact symbol or file path is selected from search results before impact analysis continues.',
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
    ]),
  );
  expect(report.missionControl.whyNow).toContain('Intent matched');
  expect(report.missionControl.whyNow).toContain('search first');
  expect(report.nextActions[0]).toEqual(report.missionControl.primaryAction);
});

test('start report extracts top-level directory scopes for shareable evidence', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'share redacted evidence for tests with a partner',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_analyze',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['share', 'evidence', 'partner', 'redacted']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Generate scoped analysis evidence for tests',
      command: 'projscan analyze --report-scope tests --redact-paths --format json',
      tool: 'projscan_analyze',
      args: { report_scope: 'tests', redact_paths: true },
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan analyze --report-scope tests --redact-paths --format json',
    'projscan doctor --report-scope tests --redact-paths --format markdown',
    'projscan ci --report-scope tests --redact-paths --format sarif',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  for (const command of report.missionControl.readyActions.map((action) => action.command)) {
    expect(report.missionControl.proofCommands).toContain(command);
  }
  expect(
    report.missionControl.proofCommands.some((command) => command.includes('<report-scope>')),
  ).toBe(false);
});

test.each([
  [
    'share redacted evidence for src/api with a partner',
    'src/api',
    'projscan analyze --report-scope src/api --redact-paths --format json',
  ],
  [
    'export scoped redacted report for packages/api to security',
    'packages/api',
    'projscan analyze --report-scope packages/api --redact-paths --format json',
  ],
  [
    'send path safe evidence for docs/GUIDE.md to vendor',
    'docs/GUIDE.md',
    'projscan analyze --report-scope docs/GUIDE.md --redact-paths --format json',
  ],
])(
  'start report preserves shareable evidence scope extraction for %s',
  async (intent, scope, command) => {
    const root = await makeTempProject();

    const report = await computeStartReport(root, { intent });

    expect(report.missionControl.primaryAction).toEqual(
      expect.objectContaining({
        command,
        args: { report_scope: scope, redact_paths: true },
      }),
    );
  },
);

test('start report preserves multiple shareable evidence scopes', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'share redacted evidence for src/api and packages/backend with a partner',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Generate scoped analysis evidence for src/api,packages/backend',
      command:
        'projscan analyze --report-scope "src/api,packages/backend" --redact-paths --format json',
      args: { report_scope: 'src/api,packages/backend', redact_paths: true },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan doctor --report-scope "src/api,packages/backend" --redact-paths --format markdown',
  );
});

test('start report keeps unknown shareable evidence scopes as unresolved input', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'share redacted evidence with a partner',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Generate scoped analysis evidence for <report-scope>',
      command: 'projscan analyze --report-scope <report-scope> --redact-paths --format json',
      tool: 'projscan_analyze',
      args: { report_scope: '<report-scope>', redact_paths: true },
    }),
  );
  expect(report.missionControl.readyActions).toEqual([]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    expect.objectContaining({
      name: 'report_scope',
      placeholder: '<report-scope>',
    }),
  ]);
});

test('start report clarifies when intent routes but workflow mode defaults', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toBe(
    'Mission Control routed the intent, but no workflow-mode hint matched "what breaks if I rename the auth token loader", so start defaults to before_edit.',
  );
  expect(report.missionControl.routedIntent?.tool).toBe('projscan_impact');
});

test('allows autonomous continuation intents to keep bounded slice work unblocked', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'go autonomously until I tell you',
  });

  expect(report.missionControl.reviewGate.policy.approvalRequired).toBe(true);
  expect(report.missionControl.reviewGate.policy.blockedActions).toEqual([
    'release',
    'publish',
    'deploy',
    'push',
    'merge',
    'version_bump',
  ]);
  expect(report.missionControl.reviewGate.policy.summary).toBe(
    'Autonomous bounded implementation slices may continue after proof; explicit reviewer approval is still required before release, publish, deploy, push, merge, or version bump.',
  );
  expect(report.missionControl.reviewGate.checklist).toContain(
    'Continue only with another bounded implementation slice after proof; stop before release, publish, deploy, push, merge, or version bump.',
  );
  expect(report.missionControl.reviewGate.markdown).not.toContain(
    '- Start another implementation slice (`next_slice`)',
  );
  expect(report.missionControl.reviewGate.markdown).toContain('- Release (`release`)');
  expect(report.missionControl.reviewGate.markdown).toContain('- Version bump (`version_bump`)');
  expect(report.missionControl.handoffPrompt).toContain(
    'Review gate: Continue with bounded implementation slices after the current Mission Control checklist and proof; stop for approval before release, publish, deploy, push, merge, or version bump.',
  );
});

test('start report keeps no-release autonomous roadmap intents out of release workflow', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent:
      'continue autonomous no-release roadmap validation implementation; do not release publish tag push merge deploy or bump version',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_workplan',
      matchedKeywords: expect.arrayContaining(['do', 'roadmap']),
    }),
  );
  expect(report.missionControl.primaryAction.tool).toBe('projscan_workplan');
  expect(report.missionControl.primaryAction.command).toBe(
    'projscan workplan --mode before_edit --format json',
  );
  expect(report.missionControl.reviewGate.policy.blockedActions).toEqual([
    'release',
    'publish',
    'deploy',
    'push',
    'merge',
    'version_bump',
  ]);
});

test('start report allows keep-going no-release implementation loops to continue bounded slices', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'keep going with user research improvement implementation without release',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain(
    'keep going with user research improvement implementation without release',
  );
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['keep', 'going', 'implementation']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.reviewGate.policy.blockedActions).toEqual([
    'release',
    'publish',
    'deploy',
    'push',
    'merge',
    'version_bump',
  ]);
  expect(report.missionControl.reviewGate.decisions[0]).toEqual(
    expect.objectContaining({
      label: 'Continue next slice',
      reply:
        'Continue: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
    }),
  );
});

test('start report keeps no-more-release continuation wording in the workplan workflow', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'keep improving projscan after 4.8.0 with user research and no more release today',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('intent');
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_workplan',
      confidence: 'medium',
      matchedKeywords: expect.arrayContaining(['keep']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.whyNow).not.toContain('projscan_release_train');
  expect(report.missionControl.successCriteria).not.toEqual(
    expect.arrayContaining([
      'Release train readiness has no blockers before packaging or publishing continues.',
    ]),
  );
});
