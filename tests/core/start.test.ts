import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { computeStartReport } from '../../src/core/start.js';
import { routesForIntent } from '../../src/core/startMode.js';
import { actionPlanFromRoute } from '../../src/core/startRouteActions.js';
import { makeTempProject } from '../helpers/startProject.js';
import {
  expectedReviewDecisionIds,
  expectedReviewDecisionReplies,
  expectedReviewPolicy,
  expectedReviewPromptReplies,
  expectedReviewReplyQuotes,
} from '../helpers/startReviewGate.js';

function primaryActionForIntent(intent: string) {
  const route = routesForIntent(intent)[0];
  if (!route) throw new Error(`Expected a route for intent: ${intent}`);
  const action = actionPlanFromRoute('before_edit', intent, route)[0];
  if (!action) throw new Error(`Expected an action for intent: ${intent}`);
  return { action, route };
}

test('start report keeps adoption gap shaping out of the main orchestrator', () => {
  const startSource = readFileSync(path.join(process.cwd(), 'src/core/start.ts'), 'utf8');
  expect(startSource).not.toContain(
    ".filter((diagnostic) => diagnostic.status !== 'pass')",
  );

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
    /Current worktree evidence sees \d+ changed file\(s\)/,
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

test('start report routes build-next product-planning questions to bug-hunt workplan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should we build next');
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['build', 'next']),
    }),
  );
  expect(report.missionControl.routedIntent?.matchedKeywords).not.toEqual(['next']);
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode bug_hunt --format json',
      tool: 'projscan_workplan',
      args: { mode: 'bug_hunt' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
    ]),
  );

  const roadmap = await computeStartReport(root, {
    intent: 'plan the product roadmap',
  });
  expect(roadmap.mode).toBe('bug_hunt');
  expect(roadmap.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode bug_hunt --format json',
      tool: 'projscan_workplan',
      args: { mode: 'bug_hunt' },
    }),
  );
  expect(roadmap.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
    ]),
  );
});

test('start report does not use bug-hunt criteria when explicit mode overrides product planning', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    intent: 'what should we build next',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.successCriteria).not.toEqual(
    expect.arrayContaining([
      'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
      'The selected slice has a runnable verification command before implementation starts.',
      'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
    ]),
  );
});

test('start report routes generic lookup intents to search rather than bug hunt', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find the PR template',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('find the PR template');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      confidence: 'medium',
      matchedKeywords: ['find'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "the PR template" --format json',
      tool: 'projscan_search',
      args: { query: 'the PR template' },
    }),
  );
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_bug_hunt',
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'low',
      matchedKeywords: ['find', 'pr'],
    }),
  );
});

test('start report routes trust-boundary questions to privacy-check', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'does projscan read .env values?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('does projscan read .env values?');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Trust',
      tool: 'projscan_privacy_check',
      cli: 'projscan privacy-check',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['read', 'env']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan privacy-check --offline',
      tool: 'projscan_privacy_check',
      args: { offline: true },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Telemetry state, offline mode, scan root, ignored-file handling, .env content policy, plugin execution, local writes, and network-capable endpoints are reviewed.',
      'Any required trust-boundary change is made explicitly before broader analysis or report sharing continues.',
    ]),
  );
  expect(report.missionControl.proofCommands[0]).toBe('projscan privacy-check --offline');
  expect(report.missionControl.handoffPrompt).toContain('projscan privacy-check --offline');
});

test('start report turns read-first orientation questions into repo understanding', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what files should I read first',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('what files should I read first');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['first'],
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view map --format json',
  );

  const npmScripts = await computeStartReport(root, {
    intent: 'what npm scripts exist',
  });
  expect(npmScripts.mode).toBe('before_edit');
  expect(npmScripts.modeSource).toBe('default');
  expect(npmScripts.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['npm', 'scripts']),
    }),
  );
  expect(npmScripts.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(npmScripts.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ]),
  );
  expect(
    npmScripts.missionControl.alternatives?.find((route) => route.tool === 'projscan_outdated'),
  ).toBeUndefined();

  const e2eScript = await computeStartReport(root, {
    intent: 'which script runs e2e tests',
  });
  expect(e2eScript.mode).toBe('before_edit');
  expect(e2eScript.modeSource).toBe('default');
  expect(e2eScript.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['script', 'runs', 'tests']),
    }),
  );
  expect(e2eScript.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(e2eScript.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ]),
  );
  expect(
    e2eScript.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const lintCommand = await computeStartReport(root, {
    intent: 'what command runs lint',
  });
  expect(lintCommand.mode).toBe('before_edit');
  expect(lintCommand.modeSource).toBe('default');
  expect(lintCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(lintCommand.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      matchedKeywords: expect.arrayContaining(['command', 'runs', 'lint']),
    }),
  );

  const typecheckCommand = await computeStartReport(root, {
    intent: 'how do I run typecheck',
  });
  expect(typecheckCommand.mode).toBe('before_edit');
  expect(typecheckCommand.modeSource).toBe('default');
  expect(typecheckCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );

  const storybookCommand = await computeStartReport(root, {
    intent: 'how do I run storybook',
  });
  expect(storybookCommand.mode).toBe('before_edit');
  expect(storybookCommand.modeSource).toBe('default');
  expect(storybookCommand.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'storybook']),
    }),
  );
  expect(storybookCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(storybookCommand.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ]),
  );

  const cypressCommand = await computeStartReport(root, {
    intent: 'how do I run cypress tests',
  });
  expect(cypressCommand.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'cypress', 'tests']),
    }),
  );
  expect(cypressCommand.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    cypressCommand.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const failingE2e = await computeStartReport(root, {
    intent: 'e2e tests are failing',
  });
  expect(failingE2e.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns first-time codebase orientation phrasing into repo understanding', async () => {
  const root = await makeTempProject();

  const start = await computeStartReport(root, {
    intent: 'where do I start in this codebase',
  });

  expect(start.mode).toBe('before_edit');
  expect(start.modeSource).toBe('default');
  expect(start.modeReason).toContain('where do I start in this codebase');
  expect(start.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['codebase', 'start'],
    }),
  );
  expect(start.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(start.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );

  const tour = await computeStartReport(root, {
    intent: 'give me a tour of the repo',
  });
  expect(tour.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['repo', 'tour'],
    }),
  );
  expect(tour.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );

  const architecture = await computeStartReport(root, {
    intent: 'explain the architecture',
  });
  expect(architecture.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['architecture'],
    }),
  );
  expect(architecture.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
});

test('start report turns repo summary questions into cited repo understanding', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'summarize this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('summarize this repo');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['summarize'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view map --format json',
  );
});

test('start report turns coordination status questions into the one-call swarm report', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'show coordination status for parallel agents',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_coordinate',
      cli: 'projscan coordinate',
      confidence: 'high',
      matchedKeywords: ['coordination', 'status', 'parallel', 'agents'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions).toEqual([
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  ]);
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_collision'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['coordination', 'parallel', 'agents']),
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.',
      'Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan coordinate --format json');
});

test('start report turns who-else-is-working questions into the one-call swarm report', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who else is working on this',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_coordinate',
      cli: 'projscan coordinate',
      confidence: 'high',
      matchedKeywords: ['who', 'else', 'working'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.',
      'Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan coordinate --format json');
});

test('start report turns collision shorthand into the one-call swarm report', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'am I going to collide with another agent',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_coordinate',
      cli: 'projscan coordinate',
      confidence: 'high',
      matchedKeywords: ['agent', 'collide'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coordinate --format json',
      tool: 'projscan_coordinate',
      args: {},
    }),
  );
});

test('start report turns merge-order shorthand into merge-risk', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should merge first',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_merge_risk',
      cli: 'projscan merge-risk',
      confidence: 'high',
      matchedKeywords: ['merge', 'first'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan merge-risk --format json',
      tool: 'projscan_merge_risk',
      args: {},
    }),
  );
});

test('start report turns file claim requests into a safe claim action plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'claim src/core/start.ts for me',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_claim',
      cli: 'projscan claim',
      confidence: 'high',
      matchedKeywords: ['claim'],
    }),
  );
  expect(report.missionControl.actionPlan).toEqual([
    expect.objectContaining({
      label: 'Review active claims before adding a file claim',
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
    expect.objectContaining({
      label: 'Add claim for src/core/start.ts',
      command: 'projscan claim add src/core/start.ts --agent <agent-name>',
      tool: 'projscan_claim',
      args: { action: 'add', target: 'src/core/start.ts', agent: '<agent-name>' },
    }),
  ]);
  expect(report.missionControl.readyActions).toEqual([
    expect.objectContaining({
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'agent',
      placeholder: '<agent-name>',
      sourceAction: 'Review active claims before adding a file claim',
      instruction: 'Replace <agent-name> with the agent name holding the claim.',
    },
  ]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Active claims are reviewed before a new file, directory, or symbol claim is added.',
      'The target is claimed with a real agent name, and any returned contention is assigned or resolved before parallel editing continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan claim list --format json');
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan claim add src/core/start.ts --agent <agent-name>',
  );
  expect(report.missionControl.handoffPrompt).toContain('Needs input: agent=<agent-name>.');
  expect(report.missionControl.handoffPrompt).not.toContain(
    'projscan claim add src/auth.ts --agent me',
  );
});

test('start report makes explicit claim-agent requests immediately runnable', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'claim src/core/start.ts as agent-alpha',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_claim',
      cli: 'projscan claim',
      confidence: 'high',
      matchedKeywords: ['claim'],
    }),
  );
  expect(report.missionControl.actionPlan).toEqual([
    expect.objectContaining({
      label: 'Add claim for src/core/start.ts',
      command: 'projscan claim add src/core/start.ts --agent agent-alpha',
      tool: 'projscan_claim',
      args: { action: 'add', target: 'src/core/start.ts', agent: 'agent-alpha' },
    }),
  ]);
  expect(report.missionControl.readyActions[0]).toEqual(
    expect.objectContaining({
      command: 'projscan claim add src/core/start.ts --agent agent-alpha',
      tool: 'projscan_claim',
      args: { action: 'add', target: 'src/core/start.ts', agent: 'agent-alpha' },
    }),
  );
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.proofCommands).toContain(
    'projscan claim add src/core/start.ts --agent agent-alpha',
  );
});

test('start report turns active-claims questions into claim listing', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'show active claims',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Swarm coordination',
      tool: 'projscan_claim',
      cli: 'projscan claim',
      confidence: 'high',
      matchedKeywords: ['claims', 'active'],
    }),
  );
  expect(report.missionControl.actionPlan).toEqual([
    expect.objectContaining({
      label: 'Review active claims',
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
  ]);
  expect(report.missionControl.readyActions[0]).toEqual(
    expect.objectContaining({
      command: 'projscan claim list --format json',
      tool: 'projscan_claim',
      args: { action: 'list' },
    }),
  );
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Active claims, owners, leases, and contention warnings are reviewed before parallel work continues.',
      'Any stale or contended claim has a release, owner, or coordination follow-up before editing resumes.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan claim list --format json');
});

test('start report turns public contract questions into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what are the public contracts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['contracts', 'public'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
      'The developer knows which exported files or symbols need compatibility checks.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view contracts --format json',
  );
});

test('start report turns API deprecation questions into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I safely deprecate this API',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['api', 'deprecate']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: expect.arrayContaining(['api', 'deprecate']),
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
      'The developer knows which exported files or symbols need compatibility checks.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view contracts --format json',
  );
});

test('start report searches for an exact target before API breakage impact', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what will this API change break',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      cli: 'projscan impact',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['api', 'change', 'break']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "what will this API change break" --format json',
      tool: 'projscan_search',
      args: { query: 'what will this API change break' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: expect.arrayContaining(['api', 'change']),
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'An exact symbol or file path is selected from search results before impact analysis continues.',
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "what will this API change break" --format json',
  );
});

test('start report turns env-var requirement questions into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what env vars does this repo need',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['env', 'vars'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view contracts --format json',
  );
});

test('start report turns missing environment variables into contracts', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'environment variables missing',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['environment', 'variables', 'missing']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ]),
  );
});

test('start report turns local database setup commands into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const seedDatabase = await computeStartReport(root, {
    intent: 'how do I seed the database',
  });
  expect(seedDatabase.mode).toBe('before_edit');
  expect(seedDatabase.modeSource).toBe('default');
  expect(seedDatabase.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['seed', 'database']),
    }),
  );
  expect(seedDatabase.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(seedDatabase.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Package scripts and config contracts identify the seed, reset, or migration command before shell commands are guessed.',
      'The developer knows database setup preconditions, required env vars, and the safest local command to run.',
    ]),
  );

  const resetDatabase = await computeStartReport(root, {
    intent: 'what command resets the database',
  });
  expect(resetDatabase.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['command', 'resets', 'database']),
    }),
  );
  expect(resetDatabase.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );

  const runMigrations = await computeStartReport(root, {
    intent: 'what command runs migrations',
  });
  expect(runMigrations.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['command', 'runs', 'migrations']),
    }),
  );
  expect(runMigrations.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
});

test('start report turns local services setup commands into the contracts understanding view', async () => {
  const root = await makeTempProject();

  const localServices = await computeStartReport(root, {
    intent: 'how do I start local services',
  });

  expect(localServices.mode).toBe('before_edit');
  expect(localServices.modeSource).toBe('default');
  expect(localServices.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['start', 'local', 'services']),
    }),
  );
  expect(localServices.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
  expect(
    localServices.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots'),
  ).toBeUndefined();
  expect(localServices.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Local service startup scripts, container commands, and required config are reviewed before running dev services.',
      'The developer knows the safest command to start local services plus any env, port, or dependency preconditions.',
    ]),
  );

  const dockerCompose = await computeStartReport(root, {
    intent: 'what command starts docker compose',
  });
  expect(dockerCompose.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['command', 'docker', 'compose']),
    }),
  );
  expect(dockerCompose.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view contracts --format json',
      tool: 'projscan_understand',
      args: { view: 'contracts' },
    }),
  );
});

test('start report turns project run questions into the repo map instead of hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I run this project',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['run', 'project'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view map --format json',
      tool: 'projscan_understand',
      args: { view: 'map' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view map --format json',
  );
});

test('start report turns proactive proof-selection questions into the verification view', async () => {
  const root = await makeTempProject();

  const fileProof = await computeStartReport(root, {
    intent: 'which tests should I run for src/core/start.ts?',
  });

  expect(fileProof.mode).toBe('before_edit');
  expect(fileProof.modeSource).toBe('default');
  expect(fileProof.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'tests']),
    }),
  );
  expect(fileProof.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view verify --intent "which tests should I run for src/core/start.ts?" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'which tests should I run for src/core/start.ts?' },
    }),
  );
  expect(fileProof.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
      'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
    ]),
  );
  expect(fileProof.missionControl.proofCommands).toContain(
    'projscan understand --view verify --intent "which tests should I run for src/core/start.ts?" --format json',
  );
  expect(
    fileProof.missionControl.alternatives?.find((route) => route.tool === 'projscan_search'),
  ).toBeUndefined();

  const beforePush = await computeStartReport(root, {
    intent: 'what should I test before pushing',
  });

  expect(beforePush.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view verify --intent "what should I test before pushing" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'what should I test before pushing' },
    }),
  );
  expect(
    beforePush.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_regression_plan',
    ),
  ).toBeUndefined();

  const failingTests = await computeStartReport(root, {
    intent: 'tests are failing',
  });
  expect(failingTests.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns feature-placement questions into the change-readiness view', async () => {
  const root = await makeTempProject();

  const feature = await computeStartReport(root, {
    intent: 'where should I put this new feature',
  });

  expect(feature.mode).toBe('before_edit');
  expect(feature.modeSource).toBe('default');
  expect(feature.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['feature', 'put'],
    }),
  );
  expect(feature.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "where should I put this new feature" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'where should I put this new feature' },
    }),
  );
  expect(
    feature.missionControl.alternatives?.find((route) => route.tool === 'projscan_search'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['where'],
    }),
  );
  expect(feature.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Change-readiness risks, blast radius, and verification tiers are reviewed before editing starts.',
      'The developer knows which follow-up impact, test, or preflight command gates the change.',
    ]),
  );

  const authChange = await computeStartReport(root, {
    intent: 'what files do I need to change for auth',
  });

  expect(authChange.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['need', 'change', 'files'],
    }),
  );
  expect(authChange.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "what files do I need to change for auth" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'what files do I need to change for auth' },
    }),
  );
  expect(authChange.missionControl.proofCommands).toContain(
    'projscan understand --view change --intent "what files do I need to change for auth" --format json',
  );

  const oauth = await computeStartReport(root, {
    intent: 'implement OAuth login',
  });

  expect(oauth.mode).toBe('before_edit');
  expect(oauth.modeSource).toBe('default');
  expect(oauth.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['implement', 'login'],
    }),
  );
  expect(oauth.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view change --intent "implement OAuth login" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'implement OAuth login' },
    }),
  );

  const webhook = await computeStartReport(root, {
    intent: 'add billing webhook support',
  });

  expect(webhook.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['add', 'webhook', 'support'],
    }),
  );
  expect(webhook.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "add billing webhook support" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'add billing webhook support' },
    }),
  );
});

test('start report turns documentation update planning into the change-readiness view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what docs should I update for this change',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['change', 'docs', 'update'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade'),
  ).toBeUndefined();
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "what docs should I update for this change" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'what docs should I update for this change' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Change-readiness risks, blast radius, and verification tiers are reviewed before editing starts.',
      'The developer knows which follow-up impact, test, or preflight command gates the change.',
    ]),
  );
});

test('start report turns database migration placement into the change-readiness view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where should I add this database migration',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: ['database', 'migration'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view change --intent "where should I add this database migration" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'where should I add this database migration' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_search'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['where'],
    }),
  );
});

test('start report turns documentation lookup questions into search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find documentation for auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['find', 'documentation'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "documentation for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'documentation for auth' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Search results identify the target files or symbols with enough confidence to choose the next tool.',
    ]),
  );
});

test('start report turns quality and risk picture questions into a scorecard', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what is risky in this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_quality_scorecard',
      confidence: 'high',
      matchedKeywords: ['risky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan quality-scorecard --format json',
      tool: 'projscan_quality_scorecard',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Quality dimensions, top risks, and verification commands are reviewed before choosing the next task.',
      'The developer knows whether health, security, tests, maintainability, or coordination needs attention first.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan quality-scorecard --format json');
});

test('start report turns risky-file touch questions into hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what files are risky to touch',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      cli: 'projscan hotspots',
      confidence: 'high',
      matchedKeywords: ['risky', 'files', 'touch'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_quality_scorecard',
    ),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['risky'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan hotspots --format json');
});

test('start report turns complexity and refactor focus questions into hotspots', async () => {
  const root = await makeTempProject();

  const complex = await computeStartReport(root, {
    intent: 'which files are too complex',
  });

  expect(complex.mode).toBe('before_edit');
  expect(complex.modeSource).toBe('default');
  expect(complex.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      confidence: 'high',
      matchedKeywords: ['files', 'complex'],
    }),
  );
  expect(complex.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );

  const refactor = await computeStartReport(root, {
    intent: 'what file should I refactor first',
  });

  expect(refactor.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_hotspots',
      confidence: 'high',
      matchedKeywords: ['file', 'refactor'],
    }),
  );
  expect(refactor.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
  expect(
    refactor.missionControl.alternatives?.find((route) => route.tool === 'projscan_file'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['file'],
    }),
  );
});

test('start report turns performance bottleneck questions into hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find performance bottlenecks',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      confidence: 'high',
      matchedKeywords: ['performance', 'bottlenecks'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan hotspots --format json');
});

test('start report turns dead-code cleanup questions into a doctor pass', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find dead code and unused exports I can delete',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['dead', 'unused'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.',
      'Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');

  const deadCode = await computeStartReport(root, {
    intent: 'find dead code',
  });

  expect(deadCode.mode).toBe('before_edit');
  expect(deadCode.modeSource).toBe('default');
  expect(deadCode.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['dead'],
    }),
  );
  expect(deadCode.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
});

test('start report turns broad safe-delete questions into a doctor cleanup pass', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what can I safely delete?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Health',
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['safely', 'delete'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toBeUndefined();
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.',
      'Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');

  const safeRemove = await computeStartReport(root, {
    intent: 'what can I remove safely?',
  });
  expect(safeRemove.mode).toBe('before_edit');
  expect(safeRemove.modeSource).toBe('default');
  expect(safeRemove.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_doctor',
      confidence: 'high',
      matchedKeywords: ['safely', 'remove'],
    }),
  );
  expect(safeRemove.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
      args: {},
    }),
  );
  expect(
    safeRemove.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade'),
  ).toBeUndefined();
});

test('start report turns failing CI intent into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'CI is failing after this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('CI is failing after this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'failing', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns direct CI fail questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why did CI fail',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('why did CI fail');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'fail'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['why'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
});

test('start report turns GitHub Actions failures into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is GitHub Actions failing',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('why is GitHub Actions failing');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['github', 'actions', 'failing']),
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['why'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
});

test('start report turns slow CI questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is CI slow',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('why is CI slow');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'slow'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns flaky CI questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'CI is flaky',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('CI is flaky');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['ci', 'flaky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns flake reproduction questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what command reproduces the flake',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['command', 'reproduces', 'flake'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns build and lint failures into a focused regression plan', async () => {
  const root = await makeTempProject();

  const build = await computeStartReport(root, {
    intent: 'why did the build fail',
  });

  expect(build.mode).toBe('before_commit');
  expect(build.modeSource).toBe('intent');
  expect(build.modeReason).toContain('why did the build fail');
  expect(build.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['fail', 'build'],
    }),
  );
  expect(
    build.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['why'],
    }),
  );
  expect(build.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const lint = await computeStartReport(root, {
    intent: 'lint is failing',
  });

  expect(lint.mode).toBe('before_commit');
  expect(lint.modeSource).toBe('intent');
  expect(lint.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['failing', 'lint'],
    }),
  );
  expect(
    lint.missionControl.alternatives?.find((route) => route.tool === 'projscan_doctor'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['lint'],
    }),
  );
  expect(lint.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
});

test('start report turns typecheck install and stack-trace failures into a focused regression plan', async () => {
  const root = await makeTempProject();

  const typecheck = await computeStartReport(root, {
    intent: 'typecheck is failing',
  });

  expect(typecheck.mode).toBe('before_commit');
  expect(typecheck.modeSource).toBe('intent');
  expect(typecheck.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['failing', 'typecheck'],
    }),
  );

  const install = await computeStartReport(root, {
    intent: 'npm install is failing',
  });

  expect(install.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['failing', 'install'],
    }),
  );
  expect(install.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const stackTrace = await computeStartReport(root, {
    intent: 'debug this stack trace',
  });

  expect(stackTrace.mode).toBe('before_commit');
  expect(stackTrace.modeSource).toBe('intent');
  expect(stackTrace.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['debug', 'stack', 'trace'],
    }),
  );
  expect(stackTrace.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns reviewer PR-comment requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'write a PR comment for reviewers',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('write a PR comment for reviewers');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['comment', 'reviewers', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
});

test('start report turns PR risk questions into structural review', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how risky is this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('how risky is this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_review',
      cli: 'projscan review',
      confidence: 'high',
      matchedKeywords: ['pr', 'risky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan review --format json',
      tool: 'projscan_review',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural PR review reports a verdict and identifies any risk that needs owner follow-up.',
      'Review, preflight, or evidence-pack follow-up is chosen before the branch is handed to reviewers.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan review --format json');
});

test('start report turns merge risk summaries into merge preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what are the top risks before merge',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      confidence: 'high',
      matchedKeywords: ['merge', 'risks'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_merge --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_merge' },
    }),
  );
});

test('start report turns PR description requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'write a PR description',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('write a PR description');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['description', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns PR checklist requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'make a PR checklist',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['checklist', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns team-facing change summary requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I tell my team about this change',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['tell', 'team', 'change'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns reviewer-routing questions into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who should review this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('who should review this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['who', 'review', 'pr'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_review'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['review', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns changed-file owner questions into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who owns the changed files',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['who', 'owns', 'changed', 'files'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['changed'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
});

test('start report turns PR-readiness questions into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'am I ready to open a PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['ready', 'open', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
});

test('start report turns smoke-check intent into a smoke regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what smoke checks should I run before commit',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['smoke', 'checks'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level smoke --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'smoke' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The smoke regression plan identifies the smallest health and preflight commands to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level smoke --format json',
  );
});

test('start report turns test-plan questions into the verification view', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what tests should I run for my changes',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('what tests should I run for my changes');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_understand',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['run', 'tests']),
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['changes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command:
        'projscan understand --view verify --intent "what tests should I run for my changes" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'what tests should I run for my changes' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
      'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan understand --view verify --intent "what tests should I run for my changes" --format json',
  );
});

test('start report turns proof-command questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what commands prove this works',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['prove', 'commands', 'works'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
});

test('start report turns proof-command shorthand into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'give me proof commands',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['proof', 'commands'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_evidence_pack'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['proof'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns pre-push command questions into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what commands should I run before pushing',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['commands', 'pushing'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level focused --format json',
  );
});

test('start report turns full regression intent into a full before-merge plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what full regression should I run before merge',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what full regression should I run before merge');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['regression', 'full'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level full --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'full' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The full regression plan identifies release-grade build, lint, stability, and test commands to rerun.',
      'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan regression-plan --level full --format json',
  );
});

test('start report turns PR change questions into a structural diff action', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what changed in this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what changed in this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_pr_diff',
      confidence: 'high',
      matchedKeywords: ['pr', 'changed'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
      'The developer knows which changed files or symbols need deeper review.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan pr-diff --format json');

  const large = await computeStartReport(root, {
    intent: 'is this PR too large',
  });
  expect(large.mode).toBe('before_commit');
  expect(large.modeSource).toBe('intent');
  expect(large.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_pr_diff',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['pr', 'large']),
    }),
  );
  expect(large.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
});

test('start report turns commit-message requests into structural diff evidence', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'write a commit message for these changes',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('write a commit message for these changes');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: ['commit', 'message', 'changes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
      'The developer knows which changed files or symbols need deeper review.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan pr-diff --format json');

  const summary = await computeStartReport(root, {
    intent: 'summarize my changes for a commit',
  });

  expect(summary.mode).toBe('before_commit');
  expect(summary.modeSource).toBe('intent');
  expect(summary.modeReason).toContain('summarize my changes for a commit');
  expect(summary.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['commit', 'changes']),
    }),
  );
  expect(summary.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
});

test('start report turns branch change questions into a structural diff action', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what did I change since main',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what did I change since main');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: ['change', 'since', 'main'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
      'The developer knows which changed files or symbols need deeper review.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan pr-diff --format json');
});

test('start report turns branch freshness questions into structural diff evidence', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is my branch stale',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: ['branch', 'stale'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
});

test('start report turns rebase recovery into before-merge preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'rebase went wrong',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Safety gate',
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['rebase', 'wrong'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_merge --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_merge' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_merge returns proceed or only documented manual-review items.',
    ]),
  );
});

test('start report turns production incidents into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'production is down',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      cli: 'projscan regression-plan',
      confidence: 'high',
      matchedKeywords: ['production', 'down'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the smallest high-signal commands to reproduce and verify the failure.',
    ]),
  );
});

test('start report turns stack traces into a focused regression plan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where is this stack trace from',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: ['stack', 'trace'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_search'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['where'],
    }),
  );
});

test('start report turns local setup blockers into a focused regression plan', async () => {
  const root = await makeTempProject();

  const portInUse = await computeStartReport(root, {
    intent: 'port 3000 already in use',
  });

  expect(portInUse.mode).toBe('before_commit');
  expect(portInUse.modeSource).toBe('intent');
  expect(portInUse.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Regression',
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['port']),
    }),
  );
  expect(portInUse.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );
  expect(portInUse.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The focused regression plan identifies the local setup command, environment symptom, and smallest rerun proof for the blocker.',
    ]),
  );

  const peerConflict = await computeStartReport(root, {
    intent: 'peer dependency conflict after npm install',
  });
  expect(peerConflict.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_regression_plan',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['peer', 'install']),
    }),
  );
});

test('start report turns source-to-sink security intent into hardening dataflow', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is user input reaching SQL sinks',
  });

  expect(report.mode).toBe('hardening');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is user input reaching SQL sinks');
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Security',
      tool: 'projscan_dataflow',
      confidence: 'high',
      matchedKeywords: ['sinks', 'sql'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dataflow --format json',
      tool: 'projscan_dataflow',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dataflow findings are reviewed for direct, propagated, and bridge source-to-sink paths.',
      'Any confirmed source-to-sink path has an owner, mitigation, and rerunnable verification command before editing continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan dataflow --format json');
  expect(report.firstTenMinutes.commands[2]?.command).toBe(
    'projscan preflight --mode before_commit --format json',
  );

  const gdpr = await computeStartReport(root, {
    intent: 'GDPR compliance check',
  });
  expect(gdpr.mode).toBe('hardening');
  expect(gdpr.modeSource).toBe('intent');
  expect(gdpr.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Security',
      tool: 'projscan_dataflow',
      cli: 'projscan dataflow',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['gdpr', 'compliance']),
    }),
  );
  expect(gdpr.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dataflow --format json',
      tool: 'projscan_dataflow',
      args: {},
    }),
  );

  const secrets = await computeStartReport(root, {
    intent: 'does this endpoint expose secrets',
  });
  expect(secrets.mode).toBe('hardening');
  expect(secrets.modeSource).toBe('intent');
  expect(secrets.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Security',
      tool: 'projscan_dataflow',
      confidence: 'high',
      matchedKeywords: ['secrets', 'expose'],
    }),
  );
  expect(secrets.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dataflow --format json',
      tool: 'projscan_dataflow',
      args: {},
    }),
  );
});

test('start report turns secure-change wording into structural review', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is this change secure',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is this change secure');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_review',
      confidence: 'high',
      matchedKeywords: ['change', 'secure'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan review --format json',
      tool: 'projscan_review',
      args: {},
    }),
  );
});

test('start report turns first-fix prioritization into a bug-hunt queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I fix first',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should I fix first');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['first', 'fix'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_fix_suggest'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'medium',
      matchedKeywords: ['fix'],
    }),
  );
});

test('start report turns fastest safe fix questions into a bug-hunt queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what is the fastest safe fix',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what is the fastest safe fix');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['fastest', 'fix'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_preflight'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'medium',
      matchedKeywords: ['safe'],
    }),
  );
});

test('start report turns quick-win wording into a bug-hunt queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'find a quick win',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('find a quick win');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['quick', 'find', 'win'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
});

test('start report turns broad improve next wording into a bug-hunt planning queue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should we improve next',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should we improve next');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_bug_hunt',
      confidence: 'high',
      matchedKeywords: ['improve'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
});

test('start report turns tiny safe task prompts into bug-hunt', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what can I do in five minutes',
  });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_bug_hunt',
      cli: 'projscan bug-hunt',
      confidence: 'high',
      matchedKeywords: ['five', 'minutes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
});

test('start report turns tech debt simplification into hotspots', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what tech debt should I pay down',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Hotspots',
      tool: 'projscan_hotspots',
      cli: 'projscan hotspots',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['tech', 'debt']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
      args: {},
    }),
  );
});

test('start report turns handoff requests into an agent brief', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computeStartReport(root, {
    intent: 'give the next agent a handoff',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_agent_brief',
      confidence: 'high',
      matchedKeywords: ['handoff', 'next', 'agent'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan agent-brief --intent next_agent --format json',
      tool: 'projscan_agent_brief',
      args: { intent: 'next_agent' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The agent brief summarizes focus items, repo context, guardrails, and suggested next actions for the next developer.',
      'The handoff includes enough proof commands for the next agent to resume without rerunning broad discovery.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan agent-brief --intent next_agent --format json',
  );
  expect(report.missionControl.resume.remainingProofCommands).toContain('projscan handoff');
  expect(
    report.missionControl.resume.remainingProofToolCalls?.map((call) => call.command),
  ).not.toContain('projscan handoff');
  expect(report.missionControl.resume.remainingProofItems?.map((item) => item.command)).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.resume.remainingProofItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        stepId: 'proof-2',
        status: 'ready',
        command: 'projscan preflight --mode before_edit --format json',
        toolCall: {
          tool: 'projscan_preflight',
          args: { mode: 'before_edit' },
        },
      }),
      expect.objectContaining({
        stepId: 'proof-6',
        status: 'ready',
        label: 'projscan handoff',
        command: 'projscan handoff',
      }),
    ]),
  );
  expect(
    report.missionControl.resume.remainingProofItems?.find(
      (item) => item.command === 'projscan handoff',
    )?.toolCall,
  ).toBeUndefined();
  expect(report.missionControl.resume.checklist).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'resume-proof-2',
        kind: 'run_proof',
        command: 'projscan preflight --mode before_edit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_edit' },
      }),
      expect.objectContaining({
        id: 'resume-proof-6',
        kind: 'run_proof',
        command: 'projscan handoff',
      }),
    ]),
  );
  const handoffChecklistProof = report.missionControl.resume.checklist?.find(
    (item) => item.id === 'resume-proof-6',
  );
  expect(handoffChecklistProof).not.toHaveProperty('tool');
  expect(handoffChecklistProof).not.toHaveProperty('args');
  expect(report.missionControl.handoff.readyProof.items).toEqual(
    report.missionControl.resume.remainingProofItems,
  );
  expect(report.missionControl.runbook.markdown).toContain('Proof queue:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-6: projscan handoff (CLI only)',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-2: `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-6: `projscan handoff` (CLI only)',
  );
});

test('start report turns open-ended next-step questions into a workplan', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I do next',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_workplan',
      confidence: 'high',
      matchedKeywords: ['do', 'next'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workplan --mode before_edit --format json',
      tool: 'projscan_workplan',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.proofCommands).toContain(
    'projscan workplan --mode before_edit --format json',
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
});

test('start report turns session resume questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what did the last agent touch',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['touch', 'last'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Remembered touched files and recent session events are reviewed before resuming work.',
      'The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
});

test('start report turns leave-off questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where did I leave off',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['leave', 'off'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
});

test('start report turns changed-while-away questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what changed while I was away',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['changed', 'away'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['changed'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');

  const offline = await computeStartReport(root, {
    intent: 'what changed while I was offline',
  });
  expect(offline.mode).toBe('before_edit');
  expect(offline.modeSource).toBe('default');
  expect(offline.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['changed', 'offline']),
    }),
  );
  expect(offline.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    offline.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
});

test('start report turns wake-up questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what changed while I was asleep',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['changed', 'asleep'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['changed'],
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Remembered touched files and recent session events are reviewed before resuming work.',
      'The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
});

test('start report turns last-agent status questions into touched-file session context', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what did the last agent do',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Agent planning',
      tool: 'projscan_session',
      confidence: 'high',
      matchedKeywords: ['last', 'agent'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan session touched --format json',
      tool: 'projscan_session',
      args: { action: 'touched' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_agent_brief'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['agent'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan session touched --format json');
});

test('start report turns an issue-fix intent with an id into direct fix-suggest', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'fix issue missing-test-framework',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_fix_suggest',
      confidence: 'high',
      matchedKeywords: ['fix', 'issue'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan fix-suggest missing-test-framework --format json',
      tool: 'projscan_fix_suggest',
      args: { issue_id: 'missing-test-framework' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A concrete fix suggestion is produced for the selected issue id.',
      'The suggestion names the file, fix instruction, and verification step before editing starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan fix-suggest missing-test-framework --format json',
  );
});

test('start report turns an issue-explanation intent with an id into direct explain-issue', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'explain issue missing-test-framework',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_explain_issue',
      confidence: 'high',
      matchedKeywords: ['explain', 'issue'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan explain-issue missing-test-framework --format json',
      tool: 'projscan_explain_issue',
      args: { issue_id: 'missing-test-framework' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'A deep issue explanation is produced for the selected issue id.',
      'The explanation identifies surrounding code, related issues, similar fixes, and the next fix prompt before editing starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan explain-issue missing-test-framework --format json',
  );
});

test('start report asks doctor for issue ids when explain-issue intent lacks one', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'explain this issue',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_explain_issue',
      confidence: 'high',
      matchedKeywords: ['explain', 'issue'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find open issues before explaining one',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan doctor --format json',
    'projscan explain-issue <issue-id-from-doctor> --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan doctor --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'issue_id',
      placeholder: '<issue-id-from-doctor>',
      sourceAction: 'Find open issues before explaining one',
      instruction:
        'Replace <issue-id-from-doctor> with an issue id from projscan doctor or projscan analyze.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_doctor first');
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan explain-issue <issue-id-from-doctor> --format json',
  );
});

test('start report asks doctor for issue ids when fix-suggest intent lacks one', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I fix this issue',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_fix_suggest',
      confidence: 'high',
      matchedKeywords: ['fix', 'issue'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find open issues before choosing a fix suggestion',
      command: 'projscan doctor --format json',
      tool: 'projscan_doctor',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan doctor --format json',
    'projscan fix-suggest <issue-id-from-doctor> --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan doctor --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'issue_id',
      placeholder: '<issue-id-from-doctor>',
      sourceAction: 'Find open issues before choosing a fix suggestion',
      instruction:
        'Replace <issue-id-from-doctor> with an issue id from projscan doctor or projscan analyze.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_doctor first');
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan fix-suggest <issue-id-from-doctor> --format json',
  );
});

test('start report marks default mode when neither mode nor mode-specific intent is supplied', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('No mode-specific intent');
});

test('mission control runs impact directly when the intent names an exact symbol', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename `buildCodeGraph`',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact --symbol buildCodeGraph --format json',
      tool: 'projscan_impact',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan impact --symbol buildCodeGraph --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact --symbol buildCodeGraph --format json',
  ]);
  expect(report.missionControl.primaryAction.args).toEqual({ symbol: 'buildCodeGraph' });
  expect(report.missionControl.unresolvedInputs).toEqual([]);
});

test('mission control runs symbol impact directly for usage questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where is runAudit used',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['used'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact --symbol runAudit --format json',
      tool: 'projscan_impact',
      args: { symbol: 'runAudit' },
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact --symbol runAudit --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
      'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact --symbol runAudit --format json',
  );
});

test('mission control runs file impact directly when the intent names a path', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I change src/core/start.ts',
  });

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.primaryAction.args).toEqual({ file: 'src/core/start.ts' });
});

test('mission control runs file impact directly for deletion questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'can I delete src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['delete'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_start'),
  ).toBeUndefined();
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact src/core/start.ts --format json',
  );
});

test('mission control runs file impact directly for exact-file rollback questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'revert src/core/start.ts safely',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['revert'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
      'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact src/core/start.ts --format json',
  );
});

test('mission control searches for a target before generic rollback impact', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how do I revert this change safely',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['revert'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "how do I revert this change safely" --format json',
      tool: 'projscan_search',
      args: { query: 'how do I revert this change safely' },
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan search "how do I revert this change safely" --format json',
    'projscan impact --symbol <symbol-from-search> --format json',
    'projscan impact <file-from-search> --format json',
  ]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'An exact symbol or file path is selected from search results before impact analysis continues.',
      'The impact report is reviewed for direct and transitive dependents before editing starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "how do I revert this change safely" --format json',
  );
});

test('mission control searches for a target before schema-drop impact', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'can I drop this column',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['drop', 'column'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find exact target for impact analysis',
      command: 'projscan search "can I drop this column" --format json',
      tool: 'projscan_search',
      args: { query: 'can I drop this column' },
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan search "can I drop this column" --format json',
    'projscan impact --symbol <symbol-from-search> --format json',
    'projscan impact <file-from-search> --format json',
  ]);
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "can I drop this column" --format json',
  );
});

test('mission control runs file impact directly for dependency questions', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what depends on src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Impact',
      tool: 'projscan_impact',
      confidence: 'high',
      matchedKeywords: ['depends'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan impact src/core/start.ts --format json',
      tool: 'projscan_impact',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan impact src/core/start.ts --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([]);
  expect(report.missionControl.proofCommands).toContain(
    'projscan impact src/core/start.ts --format json',
  );
});

test('start report turns file explanation intent into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'explain src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('explain src/core/start.ts');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['explain'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file risk questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is src/core/start.ts risky?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['risky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find(
      (route) => route.tool === 'projscan_quality_scorecard',
    ),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['risky'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Hotspot reasons, related issues, imports, exports, and ownership explain why the file is risky.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns file ownership questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who owns src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['owns'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file reviewer questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who should review src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['review'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_evidence_pack'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['who', 'review'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Ownership, primary author, hotspot risk, and related issues are reviewed before choosing a reviewer.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns file authorship questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who last touched src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['last', 'touched'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_session'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['touched', 'last'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Primary author, recent history, and ownership signals are reviewed before routing reviewers or changing the file.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns file importer intent into targeted semantic graph query', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who imports src/core/start.ts',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: ['imports'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query importers --file src/core/start.ts --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'importers', file: 'src/core/start.ts' } },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The targeted graph query answers the importer/import/export question without dumping the full graph.',
      'Any returned files are reviewed before editing the queried file or symbol.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan semantic-graph --query importers --file src/core/start.ts --format json',
  );
});

test('start report turns test-location questions into a focused search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where are the tests for src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['where', 'tests'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tests for src/core/start.ts" --format json',
      tool: 'projscan_search',
      args: { query: 'tests for src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "tests for src/core/start.ts" --format json',
  );

  const authTests = await computeStartReport(root, {
    intent: 'where are tests for auth',
  });

  expect(authTests.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['where', 'tests'],
    }),
  );
  expect(authTests.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tests for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'tests for auth' },
    }),
  );
  expect(authTests.missionControl.proofCommands).toContain(
    'projscan search "tests for auth" --format json',
  );
});

test('start report turns existing-test coverage lookup into focused search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'which tests cover auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      cli: 'projscan search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['tests', 'cover']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tests for auth" --format json',
      tool: 'projscan_search',
      args: { query: 'tests for auth' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain(
    'projscan search "tests for auth" --format json',
  );
});

test('start report turns code-location questions into focused search', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what code handles billing',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: ['code', 'handles'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "billing" --format json',
      tool: 'projscan_search',
      args: { query: 'billing' },
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan search "billing" --format json');

  const cases: Array<{
    intent: string;
    command: string;
    tool?: string;
    args: Record<string, unknown>;
    route?: {
      category?: string;
      confidence?: 'high' | 'medium' | 'low';
      matchedKeywords?: string[];
    };
  }> = [
    {
      intent: 'find the handler for POST /api/users',
      command: 'projscan search "POST /api/users" --format json',
      args: { query: 'POST /api/users' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['find', 'handler', 'api'],
      },
    },
    {
      intent: 'where is the /checkout route handled',
      command: 'projscan search "/checkout" --format json',
      args: { query: '/checkout' },
    },
    {
      intent: 'where is /settings page rendered',
      command: 'projscan search "/settings page" --format json',
      args: { query: '/settings page' },
    },
    {
      intent: 'which page renders /billing',
      command: 'projscan search "/billing page" --format json',
      args: { query: '/billing page' },
    },
    {
      intent: 'where is route segment for dashboard',
      command: 'projscan search "dashboard route segment" --format json',
      args: { query: 'dashboard route segment' },
    },
    {
      intent: 'where is not-found page handled',
      command: 'projscan search "not-found page" --format json',
      args: { query: 'not-found page' },
    },
    {
      intent: 'why is /settings returning 404',
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    },
    {
      intent: 'which feature flags exist',
      command: 'projscan search "feature flags" --format json',
      args: { query: 'feature flags' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['feature', 'flags'] },
    },
    {
      intent: 'which migrations exist',
      command: 'projscan search "migrations" --format json',
      args: { query: 'migrations' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['migrations', 'exist'] },
    },
    {
      intent: 'show me generated files',
      command: 'projscan search "generated files" --format json',
      args: { query: 'generated files' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['generated', 'files'] },
    },
    {
      intent: 'where is eslint config',
      command: 'projscan search "eslint config" --format json',
      args: { query: 'eslint config' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['where', 'config'] },
    },
    {
      intent: 'which config file defines aliases',
      command: 'projscan search "aliases config" --format json',
      args: { query: 'aliases config' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['config', 'file', 'defines', 'aliases'],
      },
    },
    {
      intent: 'where is tsconfig path aliases configured',
      command: 'projscan search "tsconfig path aliases" --format json',
      args: { query: 'tsconfig path aliases' },
    },
    {
      intent: 'where is Vitest config',
      command: 'projscan search "Vitest config" --format json',
      args: { query: 'Vitest config' },
    },
    {
      intent: 'find Babel config',
      command: 'projscan search "Babel config" --format json',
      args: { query: 'Babel config' },
    },
    {
      intent: 'where is package manager configured',
      command: 'projscan search "package manager" --format json',
      args: { query: 'package manager' },
    },
    {
      intent: 'where is pnpm workspace file',
      command: 'projscan search "pnpm workspace" --format json',
      args: { query: 'pnpm workspace' },
    },
    {
      intent: 'why is vitest failing',
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    },
    {
      intent: 'where is NEXT_PUBLIC_API_URL used',
      command: 'projscan search "NEXT_PUBLIC_API_URL" --format json',
      args: { query: 'NEXT_PUBLIC_API_URL' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['where', 'used'] },
    },
    {
      intent: 'which env var controls auth',
      command: 'projscan search "auth env var" --format json',
      args: { query: 'auth env var' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['env', 'var', 'controls'],
      },
    },
    {
      intent: 'where is "Invalid token" thrown',
      command: 'projscan search "Invalid token" --format json',
      args: { query: 'Invalid token' },
      route: { category: 'Search', confidence: 'high', matchedKeywords: ['where', 'thrown'] },
    },
    {
      intent: 'find error message "Payment failed"',
      command: 'projscan search "Payment failed" --format json',
      args: { query: 'Payment failed' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['find', 'error', 'message'],
      },
    },
    {
      intent: 'where do we log "could not connect"',
      command: 'projscan search "could not connect" --format json',
      args: { query: 'could not connect' },
    },
    {
      intent: 'what background jobs exist',
      command: 'projscan search "background jobs" --format json',
      args: { query: 'background jobs' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['background', 'jobs', 'exist'],
      },
    },
    {
      intent: 'find the email queue processor',
      command: 'projscan search "email queue processor" --format json',
      args: { query: 'email queue processor' },
    },
    {
      intent: 'where are scheduled tasks defined',
      command: 'projscan search "scheduled tasks" --format json',
      args: { query: 'scheduled tasks' },
    },
    {
      intent: 'where are metrics emitted',
      command: 'projscan search "metrics" --format json',
      args: { query: 'metrics' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['where', 'metrics', 'emitted'],
      },
    },
    {
      intent: 'where do we initialize Sentry',
      command: 'projscan search "Sentry" --format json',
      args: { query: 'Sentry' },
    },
    {
      intent: 'what logs should I check for checkout',
      command: 'projscan search "checkout logs" --format json',
      args: { query: 'checkout logs' },
    },
    {
      intent: 'find the dashboard for payments',
      command: 'projscan search "payments dashboard" --format json',
      args: { query: 'payments dashboard' },
    },
    {
      intent: 'where is seed data defined',
      command: 'projscan search "seed data" --format json',
      args: { query: 'seed data' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['where', 'seed', 'data', 'defined'],
      },
    },
    {
      intent: 'find fixtures for checkout',
      command: 'projscan search "checkout fixtures" --format json',
      args: { query: 'checkout fixtures' },
    },
    {
      intent: 'which mocks are used for payments',
      command: 'projscan search "payments mocks" --format json',
      args: { query: 'payments mocks' },
    },
    {
      intent: 'where are Storybook stories for Button',
      command: 'projscan search "Button Storybook stories" --format json',
      args: { query: 'Button Storybook stories' },
    },
    {
      intent: 'which story renders checkout',
      command: 'projscan search "checkout story" --format json',
      args: { query: 'checkout story' },
    },
    {
      intent: 'where are permissions checked for checkout',
      command: 'projscan search "checkout permissions" --format json',
      args: { query: 'checkout permissions' },
      route: {
        category: 'Search',
        confidence: 'high',
        matchedKeywords: ['where', 'permissions', 'checked'],
      },
    },
    {
      intent: 'which role can access admin',
      command: 'projscan search "admin role access" --format json',
      args: { query: 'admin role access' },
    },
    {
      intent: 'where is RBAC defined',
      command: 'projscan search "RBAC" --format json',
      args: { query: 'RBAC' },
    },
    {
      intent: 'what routes require login',
      command: 'projscan search "login routes" --format json',
      args: { query: 'login routes' },
    },
    {
      intent: 'where is rate limiting configured',
      command: 'projscan search "rate limiting" --format json',
      args: { query: 'rate limiting' },
    },
    {
      intent: 'what rate limits protect checkout',
      command: 'projscan search "checkout rate limits" --format json',
      args: { query: 'checkout rate limits' },
    },
    {
      intent: 'where is cache invalidated for products',
      command: 'projscan search "products cache invalidation" --format json',
      args: { query: 'products cache invalidation' },
    },
    {
      intent: 'which code retries failed requests',
      command: 'projscan search "failed requests retries" --format json',
      args: { query: 'failed requests retries' },
    },
    {
      intent: 'what sets request timeout',
      command: 'projscan search "request timeout" --format json',
      args: { query: 'request timeout' },
    },
    {
      intent: 'find idempotency key handling',
      command: 'projscan search "idempotency key handling" --format json',
      args: { query: 'idempotency key handling' },
    },
    {
      intent: 'where is webhook signature verified',
      command: 'projscan search "webhook signature verification" --format json',
      args: { query: 'webhook signature verification' },
    },
    {
      intent: 'where is input validation for signup',
      command: 'projscan search "signup input validation" --format json',
      args: { query: 'signup input validation' },
    },
    {
      intent: 'which schema validates checkout',
      command: 'projscan search "checkout validation schema" --format json',
      args: { query: 'checkout validation schema' },
    },
    {
      intent: 'where are request params parsed',
      command: 'projscan search "request params parsing" --format json',
      args: { query: 'request params parsing' },
    },
    {
      intent: 'what serializes API response',
      command: 'projscan search "API response serialization" --format json',
      args: { query: 'API response serialization' },
    },
    {
      intent: 'where is database transaction started',
      command: 'projscan search "database transaction" --format json',
      args: { query: 'database transaction' },
    },
    {
      intent: 'where do we lock the order row',
      command: 'projscan search "order row lock" --format json',
      args: { query: 'order row lock' },
    },
    {
      intent: 'what validates email uniqueness',
      command: 'projscan search "email uniqueness validation" --format json',
      args: { query: 'email uniqueness validation' },
    },
    {
      intent: 'what builds pagination cursors',
      command: 'projscan search "pagination cursors" --format json',
      args: { query: 'pagination cursors' },
    },
    {
      intent: 'where is the signup form submitted',
      command: 'projscan search "signup form submit" --format json',
      args: { query: 'signup form submit' },
    },
    {
      intent: 'where is loading state for dashboard',
      command: 'projscan search "dashboard loading state" --format json',
      args: { query: 'dashboard loading state' },
    },
    {
      intent: 'what renders empty state for search results',
      command: 'projscan search "search results empty state" --format json',
      args: { query: 'search results empty state' },
    },
    {
      intent: 'where is error boundary for settings',
      command: 'projscan search "settings error boundary" --format json',
      args: { query: 'settings error boundary' },
    },
    {
      intent: 'where is toast shown after checkout',
      command: 'projscan search "checkout toast" --format json',
      args: { query: 'checkout toast' },
    },
    {
      intent: 'where is keyboard shortcut for save',
      command: 'projscan search "save keyboard shortcut" --format json',
      args: { query: 'save keyboard shortcut' },
    },
    {
      intent: 'find command palette actions',
      command: 'projscan search "command palette actions" --format json',
      args: { query: 'command palette actions' },
    },
    {
      intent: 'what component renders the billing page',
      command: 'projscan search "billing page component" --format json',
      args: { query: 'billing page component' },
    },
    {
      intent: 'where are i18n translations for checkout',
      command: 'projscan search "checkout translations" --format json',
      args: { query: 'checkout translations' },
    },
    {
      intent: 'where is aria label for submit button',
      command: 'projscan search "submit button aria label" --format json',
      args: { query: 'submit button aria label' },
    },
    {
      intent: 'where is focus trap implemented',
      command: 'projscan search "focus trap" --format json',
      args: { query: 'focus trap' },
    },
    {
      intent: 'where are design tokens defined',
      command: 'projscan search "design tokens" --format json',
      args: { query: 'design tokens' },
    },
    {
      intent: 'where is Tailwind theme configured',
      command: 'projscan search "Tailwind theme" --format json',
      args: { query: 'Tailwind theme' },
    },
    {
      intent: 'where is global CSS imported',
      command: 'projscan search "global CSS" --format json',
      args: { query: 'global CSS' },
    },
    {
      intent: 'which CSS module styles Button',
      command: 'projscan search "Button CSS module" --format json',
      args: { query: 'Button CSS module' },
    },
    {
      intent: 'where is dark mode configured',
      command: 'projscan search "dark mode" --format json',
      args: { query: 'dark mode' },
    },
    {
      intent: 'what breakpoints are defined',
      command: 'projscan search "breakpoints" --format json',
      args: { query: 'breakpoints' },
    },
    {
      intent: 'why is dark mode failing',
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    },
    {
      intent: 'where is sidebar nav item for billing',
      command: 'projscan search "billing sidebar nav item" --format json',
      args: { query: 'billing sidebar nav item' },
    },
    {
      intent: 'which breadcrumb renders settings',
      command: 'projscan search "settings breadcrumb" --format json',
      args: { query: 'settings breadcrumb' },
    },
    {
      intent: 'where is page title set for checkout',
      command: 'projscan search "checkout page title" --format json',
      args: { query: 'checkout page title' },
    },
    {
      intent: 'where is Next.js layout for dashboard',
      command: 'projscan search "dashboard Next.js layout" --format json',
      args: { query: 'dashboard Next.js layout' },
    },
    {
      intent: 'where is auth state stored',
      command: 'projscan search "auth state store" --format json',
      args: { query: 'auth state store' },
    },
    {
      intent: 'find Redux slice for cart',
      command: 'projscan search "cart Redux slice" --format json',
      args: { query: 'cart Redux slice' },
    },
    {
      intent: 'where is Zustand store for user settings',
      command: 'projscan search "user settings Zustand store" --format json',
      args: { query: 'user settings Zustand store' },
    },
    {
      intent: 'which context provider supplies theme',
      command: 'projscan search "theme context provider" --format json',
      args: { query: 'theme context provider' },
    },
    {
      intent: 'which hook fetches invoices',
      command: 'projscan search "invoices hook" --format json',
      args: { query: 'invoices hook' },
    },
    {
      intent: 'where is React Query mutation for checkout',
      command: 'projscan search "checkout React Query mutation" --format json',
      args: { query: 'checkout React Query mutation' },
    },
    {
      intent: 'where is Prisma model for User',
      command: 'projscan search "User Prisma model" --format json',
      args: { query: 'User Prisma model' },
    },
    {
      intent: 'find Drizzle schema for invoices',
      command: 'projscan search "invoices Drizzle schema" --format json',
      args: { query: 'invoices Drizzle schema' },
    },
    {
      intent: 'where is SQL query for invoices',
      command: 'projscan search "invoices SQL query" --format json',
      args: { query: 'invoices SQL query' },
    },
    {
      intent: 'which repository saves orders',
      command: 'projscan search "orders repository" --format json',
      args: { query: 'orders repository' },
    },
    {
      intent: 'find DAO for payments',
      command: 'projscan search "payments DAO" --format json',
      args: { query: 'payments DAO' },
    },
    {
      intent: 'where do we call Stripe',
      command: 'projscan search "Stripe API" --format json',
      args: { query: 'Stripe API' },
    },
    {
      intent: 'which code sends email through SendGrid',
      command: 'projscan search "SendGrid email" --format json',
      args: { query: 'SendGrid email' },
    },
    {
      intent: 'where is S3 upload implemented',
      command: 'projscan search "S3 upload" --format json',
      args: { query: 'S3 upload' },
    },
    {
      intent: 'find GitHub API client',
      command: 'projscan search "GitHub API client" --format json',
      args: { query: 'GitHub API client' },
    },
    {
      intent: 'where is GraphQL query for invoices',
      command: 'projscan search "invoices GraphQL query" --format json',
      args: { query: 'invoices GraphQL query' },
    },
    {
      intent: 'where is websocket connection opened',
      command: 'projscan search "websocket connection" --format json',
      args: { query: 'websocket connection' },
    },
    {
      intent: 'where is OpenAPI spec defined',
      command: 'projscan search "OpenAPI spec" --format json',
      args: { query: 'OpenAPI spec' },
    },
    {
      intent: 'where is Swagger docs configured',
      command: 'projscan search "Swagger docs" --format json',
      args: { query: 'Swagger docs' },
    },
    {
      intent: 'where is tRPC router for billing',
      command: 'projscan search "billing tRPC router" --format json',
      args: { query: 'billing tRPC router' },
    },
    {
      intent: 'which GraphQL resolver handles invoices',
      command: 'projscan search "invoices GraphQL resolver" --format json',
      args: { query: 'invoices GraphQL resolver' },
    },
    {
      intent: 'which protobuf defines user service',
      command: 'projscan search "user service protobuf" --format json',
      args: { query: 'user service protobuf' },
    },
    {
      intent: 'where is gRPC client for payments',
      command: 'projscan search "payments gRPC client" --format json',
      args: { query: 'payments gRPC client' },
    },
    {
      intent: 'where is the Dockerfile',
      command: 'projscan search "Dockerfile" --format json',
      args: { query: 'Dockerfile' },
    },
    {
      intent: 'where is docker compose for local dev',
      command: 'projscan search "local dev docker compose" --format json',
      args: { query: 'local dev docker compose' },
    },
    {
      intent: 'where are Kubernetes manifests',
      command: 'projscan search "Kubernetes manifests" --format json',
      args: { query: 'Kubernetes manifests' },
    },
    {
      intent: 'find Helm chart for payments',
      command: 'projscan search "payments Helm chart" --format json',
      args: { query: 'payments Helm chart' },
    },
    {
      intent: 'where is Terraform module for S3',
      command: 'projscan search "S3 Terraform module" --format json',
      args: { query: 'S3 Terraform module' },
    },
    {
      intent: 'which GitHub workflow deploys staging',
      command: 'projscan search "staging GitHub workflow" --format json',
      args: { query: 'staging GitHub workflow' },
    },
    {
      intent: 'where is Vercel config',
      command: 'projscan search "Vercel config" --format json',
      args: { query: 'Vercel config' },
    },
    {
      intent: 'where is password reset handled',
      command: 'projscan search "password reset" --format json',
      args: { query: 'password reset' },
    },
    {
      intent: 'where is team invite flow',
      command: 'projscan search "team invite flow" --format json',
      args: { query: 'team invite flow' },
    },
    {
      intent: 'where is onboarding flow implemented',
      command: 'projscan search "onboarding flow" --format json',
      args: { query: 'onboarding flow' },
    },
    {
      intent: 'find CSV export for users',
      command: 'projscan search "users CSV export" --format json',
      args: { query: 'users CSV export' },
    },
    {
      intent: 'what creates audit log entries',
      command: 'projscan search "audit log entries" --format json',
      args: { query: 'audit log entries' },
    },
    {
      intent: 'where is refund handling for payments',
      command: 'projscan search "payments refund handling" --format json',
      args: { query: 'payments refund handling' },
    },
    {
      intent: 'where is subscription renewal handled',
      command: 'projscan search "subscription renewal" --format json',
      args: { query: 'subscription renewal' },
    },
    {
      intent: 'where is welcome email template',
      command: 'projscan search "welcome email template" --format json',
      args: { query: 'welcome email template' },
    },
    {
      intent: 'find password reset email copy',
      command: 'projscan search "password reset email copy" --format json',
      args: { query: 'password reset email copy' },
    },
    {
      intent: 'where is push notification copy for invites',
      command: 'projscan search "invites push notification copy" --format json',
      args: { query: 'invites push notification copy' },
    },
    {
      intent: 'where is SMS verification template',
      command: 'projscan search "SMS verification template" --format json',
      args: { query: 'SMS verification template' },
    },
    {
      intent: 'which template sends receipt email',
      command: 'projscan search "receipt email template" --format json',
      args: { query: 'receipt email template' },
    },
    {
      intent: 'where is invoice PDF generated',
      command: 'projscan search "invoice PDF" --format json',
      args: { query: 'invoice PDF' },
    },
  ];

  for (const { intent, command, tool = 'projscan_search', args, route: expectedRoute } of cases) {
    const { action, route } = primaryActionForIntent(intent);
    if (expectedRoute) {
      expect(route).toEqual(
        expect.objectContaining({
          category: expectedRoute.category,
          tool,
          confidence: expectedRoute.confidence,
          matchedKeywords: expectedRoute.matchedKeywords
            ? expect.arrayContaining(expectedRoute.matchedKeywords)
            : undefined,
        }),
      );
    }
    expect(action).toEqual(expect.objectContaining({ command, tool, args }));
  }
});

test('start report turns exact-file test coverage questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is src/core/start.ts covered by tests?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['covered', 'tests'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coverage, hotspot risk, and related test evidence for the file are reviewed before editing starts.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file test-authoring questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what tests should I add for src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['add', 'tests'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'File purpose, risky functions, coverage, and existing test evidence are reviewed before designing a new test.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns exact-file read-before-change questions into direct file inspection', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I read before changing src/core/start.ts?',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Understand',
      tool: 'projscan_file',
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan file src/core/start.ts --format json',
      tool: 'projscan_file',
      args: { file: 'src/core/start.ts' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand'),
  ).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['read'],
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Purpose, imports, exports, ownership, tests, and risk are reviewed before changing the named file.',
      'The file purpose, imports, exports, ownership, and risk are reviewed before editing starts.',
      'Any follow-up impact, owner, or test command from the file report is added to the workplan.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan file src/core/start.ts --format json',
  );
});

test('start report turns package importer intent into targeted semantic graph query', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'which files import chalk',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: ['import'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol chalk --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'chalk' } },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.proofCommands).toContain(
    'projscan semantic-graph --query package_importers --symbol chalk --format json',
  );

  const packageWord = await computeStartReport(root, {
    intent: 'which files import package chalk',
  });
  expect(packageWord.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['import']),
    }),
  );
  expect(packageWord.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol chalk --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'chalk' } },
    }),
  );
  expect(
    packageWord.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade'),
  ).toBeUndefined();

  const packageUse = await computeStartReport(root, {
    intent: 'who uses lodash',
  });
  expect(packageUse.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['uses']),
    }),
  );
  expect(packageUse.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol lodash --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'lodash' } },
    }),
  );

  const whyDependency = await computeStartReport(root, {
    intent: 'why do we depend on lodash',
  });
  expect(whyDependency.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['depend']),
    }),
  );
  expect(whyDependency.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query package_importers --symbol lodash --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'package_importers', symbol: 'lodash' } },
    }),
  );
});

test('start report turns symbol definition intent into targeted semantic graph query', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'where is runAudit defined',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_semantic_graph',
      confidence: 'high',
      matchedKeywords: ['defined'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan semantic-graph --query symbol_defs --symbol runAudit --format json',
      tool: 'projscan_semantic_graph',
      args: { query: { direction: 'symbol_defs', symbol: 'runAudit' } },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.proofCommands).toContain(
    'projscan semantic-graph --query symbol_defs --symbol runAudit --format json',
  );
});

test('start report turns coverage-gap intent into scariest untested files analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what are the scariest untested files',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('what are the scariest untested files');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Tests',
      tool: 'projscan_coverage',
      confidence: 'high',
      matchedKeywords: ['scariest', 'untested'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coverage --format json',
      tool: 'projscan_coverage',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Coverage gaps are ranked by risk so the next test target is explicit.',
      'The selected file has either a new test plan, an owner, or a documented reason to defer.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan coverage --format json');

  const noTests = await computeStartReport(root, {
    intent: 'which files have no tests',
  });
  expect(noTests.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_coverage',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['files', 'no', 'tests']),
    }),
  );
  expect(noTests.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan coverage --format json',
      tool: 'projscan_coverage',
      args: {},
    }),
  );
  expect(
    noTests.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan'),
  ).toBeUndefined();
});

test('start report turns package bump intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I bump chalk to 6',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['bump'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade chalk --format json',
      tool: 'projscan_upgrade',
      args: { package: 'chalk' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The upgrade preview identifies declared version, installed version, breaking markers, and importers.',
      'Importer files are reviewed before changing the package version.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan upgrade chalk --format json');
});

test('start report turns package update intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I update react',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['update'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade react --format json',
      tool: 'projscan_upgrade',
      args: { package: 'react' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['breaks'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan upgrade react --format json');
});

test('start report turns package removal intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'can I remove lodash',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['remove'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade lodash --format json',
      tool: 'projscan_upgrade',
      args: { package: 'lodash' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The upgrade preview identifies declared version, installed version, breaking markers, and importers.',
      'Importer files are reviewed before changing the package version.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan upgrade lodash --format json');
});

test('start report turns reversed package removal intent into direct upgrade preview', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is lodash safe to remove',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is lodash safe to remove');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['remove'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan upgrade lodash --format json',
      tool: 'projscan_upgrade',
      args: { package: 'lodash' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_doctor'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain('projscan upgrade lodash --format json');
});

test('start report turns package CVE questions into scoped audit', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'does lodash have a CVE',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_audit',
      confidence: 'high',
      matchedKeywords: ['cve'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan audit --package lodash --format json',
      tool: 'projscan_audit',
      args: { package: 'lodash' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'npm audit findings are reviewed for critical, high, moderate, low, and info vulnerabilities.',
      'Any vulnerable dependency has a fix, upgrade preview, or documented deferral before the branch is trusted.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan audit --package lodash --format json',
  );
});

test('start report turns repo CVE questions into audit', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what CVEs affect this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_audit',
      confidence: 'high',
      matchedKeywords: ['cves'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan audit --format json',
      tool: 'projscan_audit',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['affect'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan audit --format json');
});

test('start report turns monorepo workspace questions into workspaces', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what workspaces are in this repo',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_workspaces',
      confidence: 'high',
      matchedKeywords: ['workspaces'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workspaces --format json',
      tool: 'projscan_workspaces',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Monorepo workspace packages are listed with names and relative paths before package-scoped work begins.',
      'The selected workspace name is available for package-scoped follow-up commands such as hotspots, coupling, review, or audit.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan workspaces --format json');
});

test('start report turns workspace ownership questions into workspaces', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'which workspace owns auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_workspaces',
      confidence: 'high',
      matchedKeywords: ['workspace', 'owns'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan workspaces --format json',
      tool: 'projscan_workspaces',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
});

test('start report searches before answering area ownership lookup', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who owns auth',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      cli: 'projscan search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['owns']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "auth" --format json',
      tool: 'projscan_search',
      args: { query: 'auth' },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Search results identify the target files or symbols with enough confidence to choose the next tool.',
    ]),
  );

  const ask = await computeStartReport(root, {
    intent: 'who should I ask about auth',
  });
  expect(ask.mode).toBe('before_edit');
  expect(ask.modeSource).toBe('default');
  expect(ask.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      cli: 'projscan search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['ask']),
    }),
  );
  expect(ask.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "auth" --format json',
      tool: 'projscan_search',
      args: { query: 'auth' },
    }),
  );
  expect(
    ask.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim'),
  ).toBeUndefined();
});

test('start report lists outdated dependencies before upgrade preview when package is missing', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what package should I upgrade',
  });

  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_upgrade',
      confidence: 'high',
      matchedKeywords: ['upgrade', 'package'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Find package candidates before previewing an upgrade',
      command: 'projscan outdated --format json',
      tool: 'projscan_outdated',
    }),
  );
  expect(report.missionControl.actionPlan.map((action) => action.command)).toEqual([
    'projscan outdated --format json',
    'projscan upgrade <package-from-outdated> --format json',
  ]);
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan outdated --format json',
  ]);
  expect(report.missionControl.unresolvedInputs).toEqual([
    {
      name: 'package',
      placeholder: '<package-from-outdated>',
      sourceAction: 'Find package candidates before previewing an upgrade',
      instruction:
        'Replace <package-from-outdated> with a package name from projscan outdated or projscan dependencies.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_outdated first');
  expect(report.missionControl.proofCommands).toContain('projscan outdated --format json');
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan upgrade <package-from-outdated> --format json',
  );
});

test('start report turns dependency inventory questions into dependency analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what dependencies does this repo use',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_dependencies',
      confidence: 'high',
      matchedKeywords: ['dependencies'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dependencies --format json',
      tool: 'projscan_dependencies',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Declared production and development dependencies are inventoried before package changes are planned.',
      'Any dependency risks, workspace-specific counts, or missing lockfile signal has an owner or follow-up command.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan dependencies --format json');
});

test('start report turns open-source compliance questions into dependency license inventory', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'open source compliance check',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_dependencies',
      cli: 'projscan dependencies',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['open', 'source', 'compliance']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dependencies --format json',
      tool: 'projscan_dependencies',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Dependency license counts, unknown licenses, and copyleft risks are reviewed before third-party notices or compliance sign-off.',
    ]),
  );
});

test('start report turns bundle-size questions into dependency size inventory', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'why is the bundle so large',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Dependencies',
      tool: 'projscan_dependencies',
      cli: 'projscan dependencies',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['bundle', 'large']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan dependencies --format json',
      tool: 'projscan_dependencies',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Installed package-size totals and largest packages are reviewed before bundle-size or dependency-bloat work starts.',
    ]),
  );
});

test('start report turns circular dependency questions into cycles-only coupling analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'show circular dependencies',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Architecture',
      tool: 'projscan_coupling',
      cli: 'projscan coupling',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['circular', 'dependencies']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Inspect circular import cycles',
      command: 'projscan coupling --cycles-only --format json',
      tool: 'projscan_coupling',
      args: { direction: 'cycles_only' },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Circular-import cycles are reviewed with the exact files participating in each strongly connected component.',
      'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan coupling --cycles-only --format json',
  );
});

test('start report turns module coupling questions into full coupling analysis', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what modules are tightly coupled',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Architecture',
      tool: 'projscan_coupling',
      cli: 'projscan coupling',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['modules', 'coupled']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      label: 'Inspect file coupling and instability',
      command: 'projscan coupling --format json',
      tool: 'projscan_coupling',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Fan-in, fan-out, instability, cross-package edges, and circular-import cycles are reviewed before refactoring boundaries.',
      'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.',
    ]),
  );
});

test('mission control keeps alternative routes for mixed intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit and what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.routedIntent?.tool).toBe('projscan_impact');
  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_preflight',
  );
  expect(report.missionControl.alternatives?.[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['safe', 'commit'],
    }),
  );
});

test('mission control does not duplicate preflight proof when intent routes to a safety gate', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit this change',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is it safe to commit this change');
  expect(report.recommendedWorkflow.id).toBe('pre_merge');
  expect(report.firstTenMinutes.commands.slice(0, 3).map((step) => step.command)).toEqual([
    'projscan privacy-check --offline',
    'projscan start --mode before_commit',
    'projscan preflight --mode before_commit --format json',
  ]);
  expect(report.coordinationHints[0]?.command).toBe(
    'projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
    }),
  );
  expect(report.missionControl.proofCommands[0]).toBe(
    'projscan preflight --mode before_commit --format json',
  );
  expect(report.missionControl.primaryAction.args).toEqual({ mode: 'before_commit' });
  expect(report.missionControl.proofCommands).not.toContain(
    'projscan preflight --mode before_edit --format json',
  );
  const nextActionCommands = report.nextActions
    .map((action) => action.command)
    .filter((command): command is string => typeof command === 'string');
  expect(nextActionCommands).toEqual([...new Set(nextActionCommands)]);
  expect(
    nextActionCommands.filter(
      (command) => command === 'projscan preflight --mode before_commit --format json',
    ),
  ).toHaveLength(1);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
    ]),
  );
});

test('start report preserves an explicit mode when intent suggests a different workflow', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    mode: 'before_edit',
    intent: 'is it safe to commit this change',
  });

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('explicit');
  expect(report.modeReason).toContain('explicit');
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
    }),
  );
});

test('start report routes PR blocker questions to before-commit preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what is blocking this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what is blocking this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Safety gate',
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['blocking'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
});

test('start report routes merge-readiness questions to before-merge preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is my branch ready to merge',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('is my branch ready to merge');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Safety gate',
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['merge', 'ready'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_merge --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_merge' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_merge returns proceed or only documented manual-review items.',
      'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_merge --format json',
  );
});

test('start report recommends the bug-hunt recipe for bug_hunt mode', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { mode: 'bug_hunt', maxTasks: 2 });

  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.recommendedWorkflow.name).toBe('Bug Hunt');
  expect(report.recommendedWorkflow.mcpTools).toContain('projscan_bug_hunt');
});

test('start report infers bug-hunt mode from bug-fix intent', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { intent: 'find bugs to fix before the PR' });

  expect(report.mode).toBe('bug_hunt');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('find bugs to fix before the PR');
  expect(report.recommendedWorkflow.id).toBe('bug_hunt');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan bug-hunt --format json',
      tool: 'projscan_bug_hunt',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toContain(
    'projscan bug-hunt --format json',
  );
});

test('start report infers release mode from release-readiness intent', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { intent: 'prepare this branch for release' });

  expect(report.mode).toBe('release');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('prepare this branch for release');
  expect(report.recommendedWorkflow.id).toBe('release_approval');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toContain(
    'projscan release-train --format json',
  );
  expect(report.firstTenMinutes.commands[2]?.command).toBe(
    'projscan preflight --mode before_merge --format json',
  );

  const deploy = await computeStartReport(root, { intent: 'can I deploy this' });
  expect(deploy.mode).toBe('release');
  expect(deploy.modeSource).toBe('intent');
  expect(deploy.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Release',
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['deploy']),
    }),
  );
  expect(deploy.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );

  const deployment = await computeStartReport(root, {
    intent: 'prepare this branch for deployment',
  });
  expect(deployment.mode).toBe('release');
  expect(deployment.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['deployment', 'prepare']),
    }),
  );
});

test('start report infers release mode from check-before-release phrasing', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, { intent: 'what should I check before release' });

  expect(report.mode).toBe('release');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what should I check before release');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Release',
      tool: 'projscan_release_train',
      cli: 'projscan release-train',
      confidence: 'high',
      matchedKeywords: ['release', 'check'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Release train readiness has no blockers before packaging or publishing continues.',
      'Changelog, package, SBOM, and provenance evidence are reviewed before a release handoff.',
    ]),
  );
  expect(report.firstTenMinutes.commands[2]?.command).toBe(
    'projscan preflight --mode before_merge --format json',
  );

  const deployCheck = await computeStartReport(root, {
    intent: 'what should I check before deploy',
  });
  expect(deployCheck.mode).toBe('release');
  expect(deployCheck.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['deploy', 'check']),
    }),
  );
});

test('start report routes release-note and changelog requests to release readiness', async () => {
  const root = await makeTempProject();

  const releaseNote = await computeStartReport(root, {
    intent: 'write a release note for this change',
  });

  expect(releaseNote.mode).toBe('release');
  expect(releaseNote.modeSource).toBe('intent');
  expect(releaseNote.modeReason).toContain('write a release note for this change');
  expect(releaseNote.recommendedWorkflow.id).toBe('release_approval');
  expect(releaseNote.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Release',
      tool: 'projscan_release_train',
      cli: 'projscan release-train',
      confidence: 'high',
      matchedKeywords: ['release', 'note', 'change'],
    }),
  );
  expect(releaseNote.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );
  expect(releaseNote.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Release train readiness has no blockers before packaging or publishing continues.',
      'Changelog, package, SBOM, and provenance evidence are reviewed before a release handoff.',
    ]),
  );
  expect(releaseNote.firstTenMinutes.commands[2]?.command).toBe(
    'projscan preflight --mode before_merge --format json',
  );

  const changelog = await computeStartReport(root, { intent: 'draft changelog entry' });
  expect(changelog.mode).toBe('release');
  expect(changelog.modeSource).toBe('intent');
  expect(changelog.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: ['changelog', 'draft', 'entry'],
    }),
  );
  expect(changelog.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );

  const sinceRelease = await computeStartReport(root, {
    intent: 'what changed since last release',
  });
  expect(sinceRelease.mode).toBe('release');
  expect(sinceRelease.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['changed', 'since', 'release']),
    }),
  );

  const sinceDeploy = await computeStartReport(root, { intent: 'what changed since last deploy' });
  expect(sinceDeploy.mode).toBe('release');
  expect(sinceDeploy.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['changed', 'since', 'deploy']),
    }),
  );
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
  expect(report.coordinationHints.map((hint) => hint.id)).toContain('remembered-session-context');
  expect(report.coordinationHints.map((hint) => hint.command)).toContain(
    'projscan session touched --format json',
  );
  expect(
    report.coordinationHints.find((hint) => hint.id === 'remembered-session-context')?.message,
  ).toContain('1 touched file(s)');
});

test('start report exposes a phased execution plan for fuzzy routed intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, resolve 2 input(s), then gather ${report.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(report.missionControl.executionPlan.currentPhase).toBe('ready_now');
  expect(report.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      unlocks: ['input-1', 'input-2'],
      reason: 'Run this ready command next; it can unlock later inputs or follow-up steps.',
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`),
  ).toEqual([
    'next_action:ready',
    'ready_now:ready',
    'resolve_inputs:blocked',
    'follow_up:pending',
    'proof:ready',
    'done_when:pending',
  ]);
  expect(report.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      id: 'next-action-1',
      kind: 'tool',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'ready_now')?.steps[0],
  ).toEqual(
    expect.objectContaining({
      id: 'ready-1',
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'resolve_inputs')
      ?.steps,
  ).toEqual([
    expect.objectContaining({
      id: 'input-1',
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      dependsOn: ['ready-1'],
      unlocks: ['follow-up-1'],
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      kind: 'input',
      status: 'blocked',
      label: 'file',
      dependsOn: ['ready-1'],
      unlocks: ['follow-up-2'],
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'follow_up')?.steps,
  ).toEqual([
    expect.objectContaining({
      id: 'follow-up-1',
      kind: 'tool',
      status: 'blocked',
      dependsOn: ['ready-1', 'input-1'],
      blockedBy: ['input-1'],
      command: 'projscan impact --symbol <symbol-from-search> --format json',
    }),
    expect.objectContaining({
      id: 'follow-up-2',
      kind: 'tool',
      status: 'blocked',
      dependsOn: ['ready-1', 'input-2'],
      blockedBy: ['input-2'],
      command: 'projscan impact <file-from-search> --format json',
    }),
  ]);
  const proofSteps =
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'proof')?.steps ?? [];
  expect(proofSteps.map((step) => step.command)).toEqual(report.missionControl.proofCommands);
  expect(proofSteps[0]).toEqual(
    expect.objectContaining({
      id: 'proof-1',
      kind: 'proof',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(proofSteps[1]).toEqual(
    expect.objectContaining({
      id: 'proof-2',
      kind: 'proof',
      status: 'ready',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    }),
  );
  expect(report.missionControl.resume).toEqual(
    expect.objectContaining({
      currentStep: report.missionControl.executionPlan.cursor,
      status: 'ready',
      commandBlock: 'projscan search "auth token loader" --format json',
      toolCall: {
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
      },
      instruction: 'Run projscan search "auth token loader" --format json.',
      prompt:
        'Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
    }),
  );
  expect(report.missionControl.resume.unlocks).toEqual([
    expect.objectContaining({
      id: 'input-1',
      phaseId: 'resolve_inputs',
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      phaseId: 'resolve_inputs',
      kind: 'input',
      status: 'blocked',
      label: 'file',
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(report.missionControl.resume.inputBindings).toEqual([
    {
      inputId: 'input-1',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
      followUpIds: ['follow-up-1'],
    },
    {
      inputId: 'input-2',
      label: 'file',
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
      followUpIds: ['follow-up-2'],
    },
  ]);
  const resumeChecklist = report.missionControl.resume.checklist ?? [];
  expect(resumeChecklist.slice(0, 5).map((item) => item.kind)).toEqual([
    'run_current',
    'resolve_input',
    'resolve_input',
    'run_follow_up',
    'run_follow_up',
  ]);
  expect(resumeChecklist[0]).toEqual(
    expect.objectContaining({
      id: 'resume-ready-1',
      kind: 'run_current',
      phaseId: 'ready_now',
      stepId: 'ready-1',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-input-1',
      kind: 'resolve_input',
      phaseId: 'resolve_inputs',
      stepId: 'input-1',
      status: 'blocked',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction:
        'Replace <symbol-from-search> with an exported symbol returned by the search step.',
      followUpIds: ['follow-up-1'],
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-follow-up-1',
      kind: 'run_follow_up',
      phaseId: 'follow_up',
      stepId: 'follow-up-1',
      status: 'blocked',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
      blockedBy: ['input-1'],
    }),
  );
  expect(resumeChecklist).not.toContainEqual(
    expect.objectContaining({
      kind: 'run_proof',
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-proof-2',
      kind: 'run_proof',
      phaseId: 'proof',
      stepId: 'proof-2',
      status: 'ready',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-criterion-1',
      kind: 'confirm_done',
      phaseId: 'done_when',
      stepId: 'criterion-1',
      status: 'pending',
      label:
        'An exact symbol or file path is selected from search results before impact analysis continues.',
    }),
  );
  expect(report.missionControl.proofCommands[0]).toBe(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.resume.remainingProofCommands).toEqual([
    'projscan preflight --mode before_edit --format json',
    'projscan understand --view verify --format json',
    'projscan preflight --format json',
  ]);
  expect(report.missionControl.resume.remainingProofToolCalls).toEqual([
    {
      stepId: 'proof-2',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    },
    {
      stepId: 'proof-3',
      command: 'projscan understand --view verify --format json',
      tool: 'projscan_understand',
      args: { view: 'verify' },
    },
    {
      stepId: 'proof-4',
      command: 'projscan preflight --format json',
      tool: 'projscan_preflight',
      args: {},
    },
  ]);
  expect(
    report.missionControl.resume.remainingProofToolCalls?.map((call) => call.tool),
  ).not.toContain('projscan_search');
  expect(report.missionControl.resume.followUps).toEqual([
    expect.objectContaining({
      id: 'follow-up-1',
      phaseId: 'follow_up',
      kind: 'tool',
      status: 'blocked',
      label: 'If search returns an exported symbol',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
      blockedBy: ['input-1'],
      dependsOn: ['ready-1', 'input-1'],
    }),
    expect.objectContaining({
      id: 'follow-up-2',
      phaseId: 'follow_up',
      kind: 'tool',
      status: 'blocked',
      label: 'If search returns a file path',
      command: 'projscan impact <file-from-search> --format json',
      tool: 'projscan_impact',
      args: { file: '<file-from-search>' },
      blockedBy: ['input-2'],
      dependsOn: ['ready-1', 'input-2'],
    }),
  ]);
  expect(report.missionControl.handoffPrompt).toContain(report.missionControl.resume.prompt);
  expect(report.missionControl.handoffPrompt).toContain('input-1 (symbol), input-2 (file)');
  expect(report.missionControl.handoffPrompt.startsWith('Resume: ')).toBe(true);
  expect(report.missionControl.handoffPrompt).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(report.missionControl.handoffPrompt).toContain(expectedReviewPromptReplies[0]);
  const handoffReadyProof = report.missionControl.handoffPrompt.split('Ready proof: ')[1] ?? '';
  expect(handoffReadyProof).not.toContain('projscan search "auth token loader" --format json');
  expect(handoffReadyProof).toContain('projscan preflight --mode before_edit --format json');
  expect(report.missionControl.handoff.currentStep).toEqual(
    report.missionControl.executionPlan.cursor,
  );
  expect(report.missionControl.handoff.resume).toEqual(report.missionControl.resume);
  expect(report.missionControl.handoff.readyProof.commands).toEqual(
    report.missionControl.resume.remainingProofCommands,
  );
  expect(report.missionControl.handoff.readyProof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(
    report.missionControl.resume.remainingProofToolCalls,
  );
  expect(
    report.missionControl.handoff.readyProof.toolCalls?.map((call) => call.tool),
  ).not.toContain('projscan_search');
  expect(report.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Find exact target for impact analysis',
      status: report.missionControl.status,
      currentPhase: 'ready_now',
      currentStep: report.missionControl.executionPlan.cursor,
      resume: report.missionControl.resume,
      readyCommandBlock: 'projscan search "auth token loader" --format json',
      blockedInputSummary: 'Needs input: symbol=<symbol-from-search>, file=<file-from-search>.',
    }),
  );
  expect(report.missionControl.runbook.currentPhase).toBe(
    report.missionControl.executionPlan.cursor.phaseId,
  );
  expect(report.missionControl.runbook.readyCommandBlock).not.toContain('<');
  expect(report.missionControl.runbook.markdown).toContain('# Mission Runbook');
  expect(report.missionControl.runbook.markdown).toContain(
    'Intent: what breaks if I rename the auth token loader',
  );
  expect(report.missionControl.runbook.markdown).toContain('## Current Cursor');
  expect(report.missionControl.runbook.markdown).toContain('- Step: ready-1 in ready_now');
  expect(report.missionControl.runbook.markdown).toContain(
    '- Command: `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- MCP call: projscan_search {"query":"auth token loader"}',
  );
  expect(report.missionControl.runbook.markdown).toContain('- Unlocks: input-1, input-2');
  expect(report.missionControl.runbook.markdown).toContain(
    '- Why: Run this ready command next; it can unlock later inputs or follow-up steps.',
  );
  expect(report.missionControl.runbook.markdown).toContain('## Resume');
  expect(report.missionControl.runbook.markdown).toContain('Run now:');
  expect(report.missionControl.runbook.markdown).toContain(
    '```sh\nprojscan search "auth token loader" --format json\n```',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    'MCP call: projscan_search {"query":"auth token loader"}',
  );
  expect(report.missionControl.runbook.markdown).toContain('After running, resolve:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain('Template inputs:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- <file-from-search> -> input-2 (file): Replace <file-from-search> with a file path returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain('Resume checklist:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- [pending] confirm_done criterion-1: An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.runbook.markdown).toContain('Remaining proof:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan preflight --mode before_edit --format json`',
  );
  expect(report.missionControl.runbook.markdown).not.toContain(
    'Remaining proof:\n- `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain('MCP proof calls:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-2: projscan_preflight {"mode":"before_edit"}',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- proof-3: projscan_understand {"view":"verify"}',
  );
  expect(report.missionControl.runbook.markdown).toContain('Then use:');
  expect(report.missionControl.runbook.markdown).toContain(
    '- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    'Prompt: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(report.missionControl.runbook.markdown).toContain('## Handoff Prompt');
  expect(report.missionControl.runbook.markdown).toContain(report.missionControl.handoffPrompt);
  expect(report.missionControl.runbook.markdown.indexOf('## Resume')).toBeLessThan(
    report.missionControl.runbook.markdown.indexOf('## Handoff Prompt'),
  );
  expect(report.missionControl.runbook.markdown.indexOf('## Handoff Prompt')).toBeLessThan(
    report.missionControl.runbook.markdown.indexOf('## Ready Commands'),
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(report.missionControl.runbook.markdown).toContain(
    '- An exact symbol or file path is selected from search results before impact analysis continues.',
  );
});

test('start report escapes shell expansion syntax in routed freeform commands', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename $(touch /tmp/projscan-quote-pwn) auth `token` loader',
  });

  const command = report.missionControl.executionPlan.cursor.command;
  expect(command).toBe(
    'projscan search "\\$(touch /tmp/projscan-quote-pwn) auth \\`token\\` loader" --format json',
  );
  expect(command).not.toContain('"$(touch /tmp/projscan-quote-pwn)');
  expect(command).not.toContain('`token`');
  expect(report.missionControl.proofCommands[0]).toBe(command);
  expect(report.missionControl.resume.commandBlock).toBe(command);
});

test('start exposes a Mission Control task card for MCP and JSON clients', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.reviewGate).toEqual(
    expect.objectContaining({
      title: 'Mission Review Gate',
      required: true,
      status: report.missionControl.status,
      stopCondition: expect.stringContaining('Stop after'),
    }),
  );
  expect(report.missionControl.reviewGate.commands).toEqual([
    'git status --short',
    'git diff --stat',
  ]);
  expect(report.missionControl.reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(report.missionControl.reviewGate.checklist).toEqual(
    expect.arrayContaining([
      'Complete this task card and remaining proof.',
      'Capture `git status --short`.',
      'Capture `git diff --stat`.',
      'Stop and ask for approval before starting another slice, release, publish, or deploy.',
    ]),
  );
  expect(report.missionControl.reviewGate.markdown).toContain('# Mission Review Gate');
  expect(report.missionControl.reviewGate.markdown).toContain('## Evidence Commands');
  expect(report.missionControl.reviewGate.worktree).toEqual(
    expect.objectContaining({
      available: false,
      clean: false,
      changedFileCount: 0,
      files: [],
      baseRef: null,
      summary: 'Current worktree evidence is unavailable: not a git repository.',
      reason: 'not a git repository',
    }),
  );
  expect(report.missionControl.reviewGate.markdown).toContain('## Worktree Evidence');
  expect(report.missionControl.reviewGate.markdown).toContain(
    'Current worktree evidence is unavailable: not a git repository.',
  );
  expect(report.missionControl.reviewGate.proof).toEqual({
    summary: report.missionControl.proofSummary,
    commands: report.missionControl.resume.remainingProofCommands,
    toolCalls: report.missionControl.resume.remainingProofToolCalls,
    items: report.missionControl.resume.remainingProofItems,
  });
  expect(report.missionControl.reviewGate.proof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(report.missionControl.reviewGate.markdown).toContain('## Proof Queue');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(report.missionControl.reviewGate.doneWhen).toEqual(report.missionControl.successCriteria);
  expect(report.missionControl.reviewGate.markdown).toContain('## Done When');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(report.missionControl.reviewGate.decisions.map((decision) => decision.id)).toEqual(
    expectedReviewDecisionIds,
  );
  expect(report.missionControl.reviewGate.decisions.map((decision) => decision.reply)).toEqual(
    expectedReviewDecisionReplies,
  );
  expect(report.missionControl.reviewGate.markdown).toContain('## Reviewer Decision');
  expect(report.missionControl.reviewGate.markdown).toContain('## Review Policy');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- Start another implementation slice (`next_slice`)',
  );
  expect(report.missionControl.reviewGate.markdown).toContain('- Version bump (`version_bump`)');
  expect(report.missionControl.reviewGate.markdown).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(report.missionControl.reviewGate.markdown).toContain(
    'Consequence: No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.',
  );
  expect(report.missionControl.reviewGate.markdown).toContain(expectedReviewReplyQuotes[0]);
  expect(report.missionControl.handoff.reviewGate).toEqual(report.missionControl.reviewGate);
  expect(report.missionControl.handoff.reviewGate.worktree).toEqual(
    report.missionControl.reviewGate.worktree,
  );
  expect(report.missionControl.handoff.reviewGate.proof).toEqual(
    report.missionControl.reviewGate.proof,
  );
  expect(report.missionControl.handoff.reviewGate.doneWhen).toEqual(
    report.missionControl.reviewGate.doneWhen,
  );
  expect(report.missionControl.handoff.reviewGate.decisions).toEqual(
    report.missionControl.reviewGate.decisions,
  );
  expect(report.missionControl.handoff.reviewGate.policy).toEqual(
    report.missionControl.reviewGate.policy,
  );
  expect(report.missionControl.taskCard).toEqual(
    expect.objectContaining({
      title: 'Mission Task Card',
      status: report.missionControl.status,
      currentPhase: report.missionControl.executionPlan.cursor.phaseId,
      currentStep: report.missionControl.executionPlan.cursor,
    }),
  );
  expect(report.missionControl.taskCard.markdown.startsWith('# Mission Task Card\n')).toBe(true);
  expect(report.missionControl.taskCard.markdown).toContain(
    'Intent: what breaks if I rename the auth token loader',
  );
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] Run `projscan search "auth token loader" --format json`',
  );
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] After inputs, run `projscan impact --symbol <symbol-from-search> --format json`',
  );
  expect(report.missionControl.taskCard.markdown).toContain('## Proof');
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] `projscan preflight --mode before_edit --format json`',
  );
  expect(report.missionControl.taskCard.markdown).toContain('## Done When');
  expect(report.missionControl.taskCard.markdown).toContain('## Review Gate');
  expect(report.missionControl.taskCard.markdown).toContain('## Reviewer Decision');
  expect(report.missionControl.taskCard.markdown).toContain(
    '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
  );
  expect(report.missionControl.taskCard.markdown).toContain(expectedReviewReplyQuotes[0]);
  expect(report.missionControl.taskCard.markdown).toContain(report.missionControl.handoffPrompt);
  expect(report.missionControl.runbook.markdown).toContain('## Review Gate');
  expect(report.missionControl.runbook.markdown).toContain('## Reviewer Decision');
  expect(report.missionControl.runbook.markdown).toContain(
    '- [ ] Request changes: The agent must address review feedback before starting more scope.',
  );
  expect(report.missionControl.runbook.markdown).toContain(expectedReviewReplyQuotes[1]);
  expect(report.missionControl.taskCard.markdown.endsWith('\n')).toBe(true);
});

test('start report exposes an unblocked execution plan for direct safety-gate intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit this change',
  });

  expect(report.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, then gather ${report.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(report.missionControl.executionPlan.currentPhase).toBe('ready_now');
  expect(report.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
      reason: 'Run this ready command next.',
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`),
  ).toEqual(['next_action:ready', 'ready_now:ready', 'proof:ready', 'done_when:pending']);
  expect(
    report.missionControl.executionPlan.phases.some((phase) => phase.id === 'resolve_inputs'),
  ).toBe(false);
  expect(report.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'tool',
      status: 'ready',
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    }),
  );
  expect(
    report.missionControl.executionPlan.phases.find((phase) => phase.id === 'done_when')?.steps[0],
  ).toEqual(
    expect.objectContaining({
      kind: 'criterion',
      status: 'pending',
      label:
        'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
    }),
  );
  expect(report.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Use projscan_preflight for is it safe to commit this change',
      status: report.missionControl.status,
      currentPhase: 'ready_now',
      readyCommandBlock: 'projscan preflight --mode before_commit --format json',
    }),
  );
  expect(report.missionControl.runbook.currentPhase).toBe(
    report.missionControl.executionPlan.cursor.phaseId,
  );
  expect(report.missionControl.runbook.blockedInputSummary).toBeUndefined();
  expect(report.missionControl.runbook.markdown).toContain(
    '- `projscan preflight --mode before_commit --format json`',
  );
  expect(report.missionControl.runbook.markdown).not.toContain('## Blocked Inputs');
});
