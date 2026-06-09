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
  expect(report.modeSource).toBe('explicit');
  expect(report.modeReason).toContain('before_edit');
  expect(report.summary).toContain('start');
  expect(report.setup.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(
    expect.arrayContaining(['node', 'package-json', 'git', 'projscan-config', 'plugins', 'mcp-startup']),
  );
  expect(report.recommendedWorkflow.id).toBe('before_edit');
  expect(report.recommendedWorkflow.commands).toContain('projscan preflight --mode before_edit --format json');
  expect(report.firstTenMinutes.commands.slice(0, 3).map((step) => step.command)).toEqual([
    'projscan privacy-check --offline',
    'projscan start --mode before_edit',
    'projscan preflight --mode before_edit --format json',
  ]);
  expect(report.firstTenMinutes.commands.map((step) => step.id)).toContain('first-pr-evidence');
  expect(report.coordinationHints.map((hint) => hint.id)).toContain('current-worktree-check');
  expect(report.coordinationHints[0]?.message).toMatch(/Current worktree evidence sees \d+ changed file\(s\)/);
  expect(report.missionControl.status).toMatch(/ready|needs_setup|needs_attention|blocked/);
  expect(report.missionControl.primaryAction.command).toBeDefined();
  expect(report.missionControl.successCriteria.length).toBeGreaterThan(0);
  expect(report.missionControl.proofCommands.some((command) => command.startsWith('projscan preflight '))).toBe(true);
  expect(report.missionControl.handoffPrompt).toContain(report.missionControl.primaryAction.command ?? '');
  expect(report.missionControl.handoffPrompt).toContain(report.missionControl.successCriteria[0] ?? '');
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
      instruction: 'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    },
    {
      name: 'file',
      placeholder: '<file-from-search>',
      sourceAction: 'Find exact target for impact analysis',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    },
  ]);
  expect(report.missionControl.proofCommands[0]).toBe('projscan search "auth token loader" --format json');
  expect(report.missionControl.proofSummary).toBe('Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  expect(report.missionControl.proofCommands.some((command) => command.includes('<'))).toBe(false);
  expect(report.missionControl.proofCommands).not.toContain('projscan impact --symbol <symbol-from-search> --format json');
  expect(report.missionControl.proofCommands).not.toContain('projscan impact <file-from-search> --format json');
  expect(report.missionControl.proofCommands).not.toContain('projscan impact --symbol buildCodeGraph --format json');
  expect(report.missionControl.handoffPrompt).toContain('Needs input: symbol=<symbol-from-search>, file=<file-from-search>.');
  expect(report.missionControl.handoffPrompt).toContain('Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  expect(report.missionControl.handoffPrompt).toContain('projscan search "auth token loader" --format json');
  expect(report.missionControl.handoffPrompt).not.toContain('projscan impact --symbol <symbol-from-search> --format json');
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
        summary: 'Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
        commands: report.missionControl.proofCommands,
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
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain('projscan_bug_hunt');
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_bug_hunt')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan understand --view map --format json');

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
  expect(npmScripts.missionControl.alternatives?.find((route) => route.tool === 'projscan_outdated')).toBeUndefined();

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
  expect(e2eScript.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toBeUndefined();

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
  expect(cypressCommand.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toBeUndefined();

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
  expect(report.missionControl.proofCommands).toContain('projscan understand --view map --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_collision')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim')).toBeUndefined();
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
  expect(report.missionControl.proofCommands).not.toContain('projscan claim add src/core/start.ts --agent <agent-name>');
  expect(report.missionControl.handoffPrompt).toContain('Needs input: agent=<agent-name>.');
  expect(report.missionControl.handoffPrompt).not.toContain('projscan claim add src/auth.ts --agent me');
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
  expect(report.missionControl.proofCommands).toContain('projscan claim add src/core/start.ts --agent agent-alpha');
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
  expect(report.missionControl.proofCommands).toContain('projscan understand --view contracts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan understand --view contracts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan search "what will this API change break" --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check')).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan understand --view contracts --format json');
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
  expect(localServices.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots')).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
      'The developer has a cited repo map and knows which files to inspect next.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan understand --view map --format json');
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
      command: 'projscan understand --view verify --intent "which tests should I run for src/core/start.ts?" --format json',
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
  expect(fileProof.missionControl.proofCommands).toContain('projscan understand --view verify --intent "which tests should I run for src/core/start.ts?" --format json');
  expect(fileProof.missionControl.alternatives?.find((route) => route.tool === 'projscan_search')).toBeUndefined();

  const beforePush = await computeStartReport(root, {
    intent: 'what should I test before pushing',
  });

  expect(beforePush.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view verify --intent "what should I test before pushing" --format json',
      tool: 'projscan_understand',
      args: { view: 'verify', intent: 'what should I test before pushing' },
    }),
  );
  expect(beforePush.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toBeUndefined();

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
      command: 'projscan understand --view change --intent "where should I put this new feature" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'where should I put this new feature' },
    }),
  );
  expect(feature.missionControl.alternatives?.find((route) => route.tool === 'projscan_search')).toEqual(
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
      command: 'projscan understand --view change --intent "what files do I need to change for auth" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'what files do I need to change for auth' },
    }),
  );
  expect(authChange.missionControl.proofCommands).toContain('projscan understand --view change --intent "what files do I need to change for auth" --format json');

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
      command: 'projscan understand --view change --intent "add billing webhook support" --format json',
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade')).toBeUndefined();
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view change --intent "what docs should I update for this change" --format json',
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
      command: 'projscan understand --view change --intent "where should I add this database migration" --format json',
      tool: 'projscan_understand',
      args: { view: 'change', intent: 'where should I add this database migration' },
    }),
  );
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_search')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_quality_scorecard')).toEqual(
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
  expect(refactor.missionControl.alternatives?.find((route) => route.tool === 'projscan_file')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact')).toBeUndefined();
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
  expect(safeRemove.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade')).toBeUndefined();
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level focused --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level focused --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level focused --format json');
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
  expect(build.missionControl.alternatives?.find((route) => route.tool === 'projscan_explain_issue')).toEqual(
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
  expect(lint.missionControl.alternatives?.find((route) => route.tool === 'projscan_doctor')).toEqual(
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
  expect(stackTrace.missionControl.proofCommands).toContain('projscan regression-plan --level focused --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan preflight --mode before_commit --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_review')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level smoke --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff')).toEqual(
    expect.objectContaining({
      matchedKeywords: ['changes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan understand --view verify --intent "what tests should I run for my changes" --format json',
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
  expect(report.missionControl.proofCommands).toContain('projscan understand --view verify --intent "what tests should I run for my changes" --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_evidence_pack')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level focused --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level focused --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan regression-plan --level full --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_search')).toEqual(
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
  expect(report.firstTenMinutes.commands[2]?.command).toBe('projscan preflight --mode before_commit --format json');

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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_fix_suggest')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_preflight')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan agent-brief --intent next_agent --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan workplan --mode before_edit --format json');
  expect(report.missionControl.proofCommands).toContain('projscan preflight --mode before_edit --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan preflight --mode before_edit --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff')).toEqual(
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
  expect(offline.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_agent_brief')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan fix-suggest missing-test-framework --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan explain-issue missing-test-framework --format json');
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
      instruction: 'Replace <issue-id-from-doctor> with an issue id from projscan doctor or projscan analyze.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_doctor first');
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');
  expect(report.missionControl.proofCommands).not.toContain('projscan explain-issue <issue-id-from-doctor> --format json');
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
      instruction: 'Replace <issue-id-from-doctor> with an issue id from projscan doctor or projscan analyze.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_doctor first');
  expect(report.missionControl.proofCommands).toContain('projscan doctor --format json');
  expect(report.missionControl.proofCommands).not.toContain('projscan fix-suggest <issue-id-from-doctor> --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan impact --symbol runAudit --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_start')).toBeUndefined();
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_hotspots')).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain('projscan impact src/core/start.ts --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan impact src/core/start.ts --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan search "how do I revert this change safely" --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan search "can I drop this column" --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan impact src/core/start.ts --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_quality_scorecard')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_evidence_pack')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_session')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan semantic-graph --query importers --file src/core/start.ts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['tests'],
    }),
  );
  expect(report.missionControl.proofCommands).toContain('projscan search "tests for src/core/start.ts" --format json');

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
  expect(authTests.missionControl.proofCommands).toContain('projscan search "tests for auth" --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain('projscan search "tests for auth" --format json');
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

  const postHandler = await computeStartReport(root, {
    intent: 'find the handler for POST /api/users',
  });
  expect(postHandler.mode).toBe('before_edit');
  expect(postHandler.modeSource).toBe('default');
  expect(postHandler.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['find', 'handler', 'api']),
    }),
  );
  expect(postHandler.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "POST /api/users" --format json',
      tool: 'projscan_search',
      args: { query: 'POST /api/users' },
    }),
  );

  const checkoutRoute = await computeStartReport(root, {
    intent: 'where is the /checkout route handled',
  });
  expect(checkoutRoute.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "/checkout" --format json',
      tool: 'projscan_search',
      args: { query: '/checkout' },
    }),
  );

  const settingsPage = await computeStartReport(root, {
    intent: 'where is /settings page rendered',
  });
  expect(settingsPage.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "/settings page" --format json',
      tool: 'projscan_search',
      args: { query: '/settings page' },
    }),
  );

  const billingPage = await computeStartReport(root, {
    intent: 'which page renders /billing',
  });
  expect(billingPage.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "/billing page" --format json',
      tool: 'projscan_search',
      args: { query: '/billing page' },
    }),
  );

  const routeSegment = await computeStartReport(root, {
    intent: 'where is route segment for dashboard',
  });
  expect(routeSegment.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "dashboard route segment" --format json',
      tool: 'projscan_search',
      args: { query: 'dashboard route segment' },
    }),
  );

  const notFoundPage = await computeStartReport(root, {
    intent: 'where is not-found page handled',
  });
  expect(notFoundPage.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "not-found page" --format json',
      tool: 'projscan_search',
      args: { query: 'not-found page' },
    }),
  );

  const runtime404 = await computeStartReport(root, {
    intent: 'why is /settings returning 404',
  });
  expect(runtime404.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const flags = await computeStartReport(root, {
    intent: 'which feature flags exist',
  });
  expect(flags.mode).toBe('before_edit');
  expect(flags.modeSource).toBe('default');
  expect(flags.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['feature', 'flags']),
    }),
  );
  expect(flags.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "feature flags" --format json',
      tool: 'projscan_search',
      args: { query: 'feature flags' },
    }),
  );

  const migrations = await computeStartReport(root, {
    intent: 'which migrations exist',
  });
  expect(migrations.mode).toBe('before_edit');
  expect(migrations.modeSource).toBe('default');
  expect(migrations.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['migrations', 'exist']),
    }),
  );
  expect(migrations.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "migrations" --format json',
      tool: 'projscan_search',
      args: { query: 'migrations' },
    }),
  );

  const generatedFiles = await computeStartReport(root, {
    intent: 'show me generated files',
  });
  expect(generatedFiles.mode).toBe('before_edit');
  expect(generatedFiles.modeSource).toBe('default');
  expect(generatedFiles.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['generated', 'files']),
    }),
  );
  expect(generatedFiles.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "generated files" --format json',
      tool: 'projscan_search',
      args: { query: 'generated files' },
    }),
  );

  const eslintConfig = await computeStartReport(root, {
    intent: 'where is eslint config',
  });
  expect(eslintConfig.mode).toBe('before_edit');
  expect(eslintConfig.modeSource).toBe('default');
  expect(eslintConfig.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['where', 'config']),
    }),
  );
  expect(eslintConfig.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "eslint config" --format json',
      tool: 'projscan_search',
      args: { query: 'eslint config' },
    }),
  );

  const aliases = await computeStartReport(root, {
    intent: 'which config file defines aliases',
  });
  expect(aliases.mode).toBe('before_edit');
  expect(aliases.modeSource).toBe('default');
  expect(aliases.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['config', 'file', 'defines', 'aliases']),
    }),
  );
  expect(aliases.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "aliases config" --format json',
      tool: 'projscan_search',
      args: { query: 'aliases config' },
    }),
  );

  const tsconfigAliases = await computeStartReport(root, {
    intent: 'where is tsconfig path aliases configured',
  });
  expect(tsconfigAliases.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "tsconfig path aliases" --format json',
      tool: 'projscan_search',
      args: { query: 'tsconfig path aliases' },
    }),
  );

  const vitestConfig = await computeStartReport(root, {
    intent: 'where is Vitest config',
  });
  expect(vitestConfig.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Vitest config" --format json',
      tool: 'projscan_search',
      args: { query: 'Vitest config' },
    }),
  );

  const babelConfig = await computeStartReport(root, {
    intent: 'find Babel config',
  });
  expect(babelConfig.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Babel config" --format json',
      tool: 'projscan_search',
      args: { query: 'Babel config' },
    }),
  );

  const packageManager = await computeStartReport(root, {
    intent: 'where is package manager configured',
  });
  expect(packageManager.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "package manager" --format json',
      tool: 'projscan_search',
      args: { query: 'package manager' },
    }),
  );

  const pnpmWorkspace = await computeStartReport(root, {
    intent: 'where is pnpm workspace file',
  });
  expect(pnpmWorkspace.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "pnpm workspace" --format json',
      tool: 'projscan_search',
      args: { query: 'pnpm workspace' },
    }),
  );

  const failingVitest = await computeStartReport(root, {
    intent: 'why is vitest failing',
  });
  expect(failingVitest.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const envUsage = await computeStartReport(root, {
    intent: 'where is NEXT_PUBLIC_API_URL used',
  });
  expect(envUsage.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['where', 'used']),
    }),
  );
  expect(envUsage.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "NEXT_PUBLIC_API_URL" --format json',
      tool: 'projscan_search',
      args: { query: 'NEXT_PUBLIC_API_URL' },
    }),
  );

  const controlEnv = await computeStartReport(root, {
    intent: 'which env var controls auth',
  });
  expect(controlEnv.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['env', 'var', 'controls']),
    }),
  );
  expect(controlEnv.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "auth env var" --format json',
      tool: 'projscan_search',
      args: { query: 'auth env var' },
    }),
  );

  const thrownString = await computeStartReport(root, {
    intent: 'where is "Invalid token" thrown',
  });
  expect(thrownString.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['where', 'thrown']),
    }),
  );
  expect(thrownString.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Invalid token" --format json',
      tool: 'projscan_search',
      args: { query: 'Invalid token' },
    }),
  );

  const errorMessage = await computeStartReport(root, {
    intent: 'find error message "Payment failed"',
  });
  expect(errorMessage.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['find', 'error', 'message']),
    }),
  );
  expect(errorMessage.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Payment failed" --format json',
      tool: 'projscan_search',
      args: { query: 'Payment failed' },
    }),
  );

  const loggedString = await computeStartReport(root, {
    intent: 'where do we log "could not connect"',
  });
  expect(loggedString.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "could not connect" --format json',
      tool: 'projscan_search',
      args: { query: 'could not connect' },
    }),
  );

  const backgroundJobs = await computeStartReport(root, {
    intent: 'what background jobs exist',
  });
  expect(backgroundJobs.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['background', 'jobs', 'exist']),
    }),
  );
  expect(backgroundJobs.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "background jobs" --format json',
      tool: 'projscan_search',
      args: { query: 'background jobs' },
    }),
  );

  const queueProcessor = await computeStartReport(root, {
    intent: 'find the email queue processor',
  });
  expect(queueProcessor.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "email queue processor" --format json',
      tool: 'projscan_search',
      args: { query: 'email queue processor' },
    }),
  );

  const scheduledTasks = await computeStartReport(root, {
    intent: 'where are scheduled tasks defined',
  });
  expect(scheduledTasks.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "scheduled tasks" --format json',
      tool: 'projscan_search',
      args: { query: 'scheduled tasks' },
    }),
  );

  const metrics = await computeStartReport(root, {
    intent: 'where are metrics emitted',
  });
  expect(metrics.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['where', 'metrics', 'emitted']),
    }),
  );
  expect(metrics.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "metrics" --format json',
      tool: 'projscan_search',
      args: { query: 'metrics' },
    }),
  );

  const sentry = await computeStartReport(root, {
    intent: 'where do we initialize Sentry',
  });
  expect(sentry.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Sentry" --format json',
      tool: 'projscan_search',
      args: { query: 'Sentry' },
    }),
  );

  const checkoutLogs = await computeStartReport(root, {
    intent: 'what logs should I check for checkout',
  });
  expect(checkoutLogs.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout logs" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout logs' },
    }),
  );

  const dashboard = await computeStartReport(root, {
    intent: 'find the dashboard for payments',
  });
  expect(dashboard.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "payments dashboard" --format json',
      tool: 'projscan_search',
      args: { query: 'payments dashboard' },
    }),
  );

  const seedData = await computeStartReport(root, {
    intent: 'where is seed data defined',
  });
  expect(seedData.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['where', 'seed', 'data', 'defined']),
    }),
  );
  expect(seedData.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "seed data" --format json',
      tool: 'projscan_search',
      args: { query: 'seed data' },
    }),
  );

  const fixtures = await computeStartReport(root, {
    intent: 'find fixtures for checkout',
  });
  expect(fixtures.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout fixtures" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout fixtures' },
    }),
  );

  const mocks = await computeStartReport(root, {
    intent: 'which mocks are used for payments',
  });
  expect(mocks.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "payments mocks" --format json',
      tool: 'projscan_search',
      args: { query: 'payments mocks' },
    }),
  );

  const stories = await computeStartReport(root, {
    intent: 'where are Storybook stories for Button',
  });
  expect(stories.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Button Storybook stories" --format json',
      tool: 'projscan_search',
      args: { query: 'Button Storybook stories' },
    }),
  );

  const story = await computeStartReport(root, {
    intent: 'which story renders checkout',
  });
  expect(story.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout story" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout story' },
    }),
  );

  const permissions = await computeStartReport(root, {
    intent: 'where are permissions checked for checkout',
  });
  expect(permissions.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Search',
      tool: 'projscan_search',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['where', 'permissions', 'checked']),
    }),
  );
  expect(permissions.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout permissions" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout permissions' },
    }),
  );

  const role = await computeStartReport(root, {
    intent: 'which role can access admin',
  });
  expect(role.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "admin role access" --format json',
      tool: 'projscan_search',
      args: { query: 'admin role access' },
    }),
  );

  const rbac = await computeStartReport(root, {
    intent: 'where is RBAC defined',
  });
  expect(rbac.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "RBAC" --format json',
      tool: 'projscan_search',
      args: { query: 'RBAC' },
    }),
  );

  const loginRoutes = await computeStartReport(root, {
    intent: 'what routes require login',
  });
  expect(loginRoutes.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "login routes" --format json',
      tool: 'projscan_search',
      args: { query: 'login routes' },
    }),
  );

  const rateLimiting = await computeStartReport(root, {
    intent: 'where is rate limiting configured',
  });
  expect(rateLimiting.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "rate limiting" --format json',
      tool: 'projscan_search',
      args: { query: 'rate limiting' },
    }),
  );

  const checkoutLimits = await computeStartReport(root, {
    intent: 'what rate limits protect checkout',
  });
  expect(checkoutLimits.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout rate limits" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout rate limits' },
    }),
  );

  const cacheInvalidation = await computeStartReport(root, {
    intent: 'where is cache invalidated for products',
  });
  expect(cacheInvalidation.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "products cache invalidation" --format json',
      tool: 'projscan_search',
      args: { query: 'products cache invalidation' },
    }),
  );

  const retryLookup = await computeStartReport(root, {
    intent: 'which code retries failed requests',
  });
  expect(retryLookup.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "failed requests retries" --format json',
      tool: 'projscan_search',
      args: { query: 'failed requests retries' },
    }),
  );

  const timeoutLookup = await computeStartReport(root, {
    intent: 'what sets request timeout',
  });
  expect(timeoutLookup.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "request timeout" --format json',
      tool: 'projscan_search',
      args: { query: 'request timeout' },
    }),
  );

  const idempotency = await computeStartReport(root, {
    intent: 'find idempotency key handling',
  });
  expect(idempotency.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "idempotency key handling" --format json',
      tool: 'projscan_search',
      args: { query: 'idempotency key handling' },
    }),
  );

  const webhookSignature = await computeStartReport(root, {
    intent: 'where is webhook signature verified',
  });
  expect(webhookSignature.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "webhook signature verification" --format json',
      tool: 'projscan_search',
      args: { query: 'webhook signature verification' },
    }),
  );

  const inputValidation = await computeStartReport(root, {
    intent: 'where is input validation for signup',
  });
  expect(inputValidation.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "signup input validation" --format json',
      tool: 'projscan_search',
      args: { query: 'signup input validation' },
    }),
  );

  const schemaValidation = await computeStartReport(root, {
    intent: 'which schema validates checkout',
  });
  expect(schemaValidation.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout validation schema" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout validation schema' },
    }),
  );

  const requestParams = await computeStartReport(root, {
    intent: 'where are request params parsed',
  });
  expect(requestParams.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "request params parsing" --format json',
      tool: 'projscan_search',
      args: { query: 'request params parsing' },
    }),
  );

  const apiSerialization = await computeStartReport(root, {
    intent: 'what serializes API response',
  });
  expect(apiSerialization.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "API response serialization" --format json',
      tool: 'projscan_search',
      args: { query: 'API response serialization' },
    }),
  );

  const transaction = await computeStartReport(root, {
    intent: 'where is database transaction started',
  });
  expect(transaction.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "database transaction" --format json',
      tool: 'projscan_search',
      args: { query: 'database transaction' },
    }),
  );

  const rowLock = await computeStartReport(root, {
    intent: 'where do we lock the order row',
  });
  expect(rowLock.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "order row lock" --format json',
      tool: 'projscan_search',
      args: { query: 'order row lock' },
    }),
  );

  const uniqueness = await computeStartReport(root, {
    intent: 'what validates email uniqueness',
  });
  expect(uniqueness.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "email uniqueness validation" --format json',
      tool: 'projscan_search',
      args: { query: 'email uniqueness validation' },
    }),
  );

  const pagination = await computeStartReport(root, {
    intent: 'what builds pagination cursors',
  });
  expect(pagination.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "pagination cursors" --format json',
      tool: 'projscan_search',
      args: { query: 'pagination cursors' },
    }),
  );

  const formSubmit = await computeStartReport(root, {
    intent: 'where is the signup form submitted',
  });
  expect(formSubmit.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "signup form submit" --format json',
      tool: 'projscan_search',
      args: { query: 'signup form submit' },
    }),
  );

  const loadingState = await computeStartReport(root, {
    intent: 'where is loading state for dashboard',
  });
  expect(loadingState.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "dashboard loading state" --format json',
      tool: 'projscan_search',
      args: { query: 'dashboard loading state' },
    }),
  );

  const emptyState = await computeStartReport(root, {
    intent: 'what renders empty state for search results',
  });
  expect(emptyState.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "search results empty state" --format json',
      tool: 'projscan_search',
      args: { query: 'search results empty state' },
    }),
  );

  const errorBoundary = await computeStartReport(root, {
    intent: 'where is error boundary for settings',
  });
  expect(errorBoundary.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "settings error boundary" --format json',
      tool: 'projscan_search',
      args: { query: 'settings error boundary' },
    }),
  );

  const toast = await computeStartReport(root, {
    intent: 'where is toast shown after checkout',
  });
  expect(toast.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout toast" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout toast' },
    }),
  );

  const shortcut = await computeStartReport(root, {
    intent: 'where is keyboard shortcut for save',
  });
  expect(shortcut.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "save keyboard shortcut" --format json',
      tool: 'projscan_search',
      args: { query: 'save keyboard shortcut' },
    }),
  );

  const commandPalette = await computeStartReport(root, {
    intent: 'find command palette actions',
  });
  expect(commandPalette.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "command palette actions" --format json',
      tool: 'projscan_search',
      args: { query: 'command palette actions' },
    }),
  );

  const pageComponent = await computeStartReport(root, {
    intent: 'what component renders the billing page',
  });
  expect(pageComponent.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "billing page component" --format json',
      tool: 'projscan_search',
      args: { query: 'billing page component' },
    }),
  );

  const translations = await computeStartReport(root, {
    intent: 'where are i18n translations for checkout',
  });
  expect(translations.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout translations" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout translations' },
    }),
  );

  const aria = await computeStartReport(root, {
    intent: 'where is aria label for submit button',
  });
  expect(aria.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "submit button aria label" --format json',
      tool: 'projscan_search',
      args: { query: 'submit button aria label' },
    }),
  );

  const focusTrap = await computeStartReport(root, {
    intent: 'where is focus trap implemented',
  });
  expect(focusTrap.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "focus trap" --format json',
      tool: 'projscan_search',
      args: { query: 'focus trap' },
    }),
  );

  const designTokens = await computeStartReport(root, {
    intent: 'where are design tokens defined',
  });
  expect(designTokens.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "design tokens" --format json',
      tool: 'projscan_search',
      args: { query: 'design tokens' },
    }),
  );

  const tailwindTheme = await computeStartReport(root, {
    intent: 'where is Tailwind theme configured',
  });
  expect(tailwindTheme.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Tailwind theme" --format json',
      tool: 'projscan_search',
      args: { query: 'Tailwind theme' },
    }),
  );

  const globalCss = await computeStartReport(root, {
    intent: 'where is global CSS imported',
  });
  expect(globalCss.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "global CSS" --format json',
      tool: 'projscan_search',
      args: { query: 'global CSS' },
    }),
  );

  const cssModule = await computeStartReport(root, {
    intent: 'which CSS module styles Button',
  });
  expect(cssModule.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Button CSS module" --format json',
      tool: 'projscan_search',
      args: { query: 'Button CSS module' },
    }),
  );

  const darkMode = await computeStartReport(root, {
    intent: 'where is dark mode configured',
  });
  expect(darkMode.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "dark mode" --format json',
      tool: 'projscan_search',
      args: { query: 'dark mode' },
    }),
  );

  const breakpoints = await computeStartReport(root, {
    intent: 'what breakpoints are defined',
  });
  expect(breakpoints.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "breakpoints" --format json',
      tool: 'projscan_search',
      args: { query: 'breakpoints' },
    }),
  );

  const failingDarkMode = await computeStartReport(root, {
    intent: 'why is dark mode failing',
  });
  expect(failingDarkMode.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan regression-plan --level focused --format json',
      tool: 'projscan_regression_plan',
      args: { level: 'focused' },
    }),
  );

  const sidebarNav = await computeStartReport(root, {
    intent: 'where is sidebar nav item for billing',
  });
  expect(sidebarNav.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "billing sidebar nav item" --format json',
      tool: 'projscan_search',
      args: { query: 'billing sidebar nav item' },
    }),
  );

  const breadcrumb = await computeStartReport(root, {
    intent: 'which breadcrumb renders settings',
  });
  expect(breadcrumb.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "settings breadcrumb" --format json',
      tool: 'projscan_search',
      args: { query: 'settings breadcrumb' },
    }),
  );

  const pageTitle = await computeStartReport(root, {
    intent: 'where is page title set for checkout',
  });
  expect(pageTitle.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout page title" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout page title' },
    }),
  );

  const nextLayout = await computeStartReport(root, {
    intent: 'where is Next.js layout for dashboard',
  });
  expect(nextLayout.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "dashboard Next.js layout" --format json',
      tool: 'projscan_search',
      args: { query: 'dashboard Next.js layout' },
    }),
  );

  const authState = await computeStartReport(root, {
    intent: 'where is auth state stored',
  });
  expect(authState.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "auth state store" --format json',
      tool: 'projscan_search',
      args: { query: 'auth state store' },
    }),
  );

  const reduxSlice = await computeStartReport(root, {
    intent: 'find Redux slice for cart',
  });
  expect(reduxSlice.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "cart Redux slice" --format json',
      tool: 'projscan_search',
      args: { query: 'cart Redux slice' },
    }),
  );

  const zustandStore = await computeStartReport(root, {
    intent: 'where is Zustand store for user settings',
  });
  expect(zustandStore.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "user settings Zustand store" --format json',
      tool: 'projscan_search',
      args: { query: 'user settings Zustand store' },
    }),
  );

  const themeProvider = await computeStartReport(root, {
    intent: 'which context provider supplies theme',
  });
  expect(themeProvider.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "theme context provider" --format json',
      tool: 'projscan_search',
      args: { query: 'theme context provider' },
    }),
  );

  const invoicesHook = await computeStartReport(root, {
    intent: 'which hook fetches invoices',
  });
  expect(invoicesHook.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invoices hook" --format json',
      tool: 'projscan_search',
      args: { query: 'invoices hook' },
    }),
  );

  const checkoutMutation = await computeStartReport(root, {
    intent: 'where is React Query mutation for checkout',
  });
  expect(checkoutMutation.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "checkout React Query mutation" --format json',
      tool: 'projscan_search',
      args: { query: 'checkout React Query mutation' },
    }),
  );

  const prismaModel = await computeStartReport(root, {
    intent: 'where is Prisma model for User',
  });
  expect(prismaModel.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "User Prisma model" --format json',
      tool: 'projscan_search',
      args: { query: 'User Prisma model' },
    }),
  );

  const drizzleSchema = await computeStartReport(root, {
    intent: 'find Drizzle schema for invoices',
  });
  expect(drizzleSchema.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invoices Drizzle schema" --format json',
      tool: 'projscan_search',
      args: { query: 'invoices Drizzle schema' },
    }),
  );

  const sqlQuery = await computeStartReport(root, {
    intent: 'where is SQL query for invoices',
  });
  expect(sqlQuery.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invoices SQL query" --format json',
      tool: 'projscan_search',
      args: { query: 'invoices SQL query' },
    }),
  );

  const repository = await computeStartReport(root, {
    intent: 'which repository saves orders',
  });
  expect(repository.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "orders repository" --format json',
      tool: 'projscan_search',
      args: { query: 'orders repository' },
    }),
  );

  const dao = await computeStartReport(root, {
    intent: 'find DAO for payments',
  });
  expect(dao.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "payments DAO" --format json',
      tool: 'projscan_search',
      args: { query: 'payments DAO' },
    }),
  );

  const stripeCall = await computeStartReport(root, {
    intent: 'where do we call Stripe',
  });
  expect(stripeCall.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Stripe API" --format json',
      tool: 'projscan_search',
      args: { query: 'Stripe API' },
    }),
  );

  const sendGridEmail = await computeStartReport(root, {
    intent: 'which code sends email through SendGrid',
  });
  expect(sendGridEmail.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "SendGrid email" --format json',
      tool: 'projscan_search',
      args: { query: 'SendGrid email' },
    }),
  );

  const s3Upload = await computeStartReport(root, {
    intent: 'where is S3 upload implemented',
  });
  expect(s3Upload.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "S3 upload" --format json',
      tool: 'projscan_search',
      args: { query: 'S3 upload' },
    }),
  );

  const githubClient = await computeStartReport(root, {
    intent: 'find GitHub API client',
  });
  expect(githubClient.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "GitHub API client" --format json',
      tool: 'projscan_search',
      args: { query: 'GitHub API client' },
    }),
  );

  const graphqlQuery = await computeStartReport(root, {
    intent: 'where is GraphQL query for invoices',
  });
  expect(graphqlQuery.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invoices GraphQL query" --format json',
      tool: 'projscan_search',
      args: { query: 'invoices GraphQL query' },
    }),
  );

  const websocketConnection = await computeStartReport(root, {
    intent: 'where is websocket connection opened',
  });
  expect(websocketConnection.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "websocket connection" --format json',
      tool: 'projscan_search',
      args: { query: 'websocket connection' },
    }),
  );

  const openApiSpec = await computeStartReport(root, {
    intent: 'where is OpenAPI spec defined',
  });
  expect(openApiSpec.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "OpenAPI spec" --format json',
      tool: 'projscan_search',
      args: { query: 'OpenAPI spec' },
    }),
  );

  const swaggerDocs = await computeStartReport(root, {
    intent: 'where is Swagger docs configured',
  });
  expect(swaggerDocs.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Swagger docs" --format json',
      tool: 'projscan_search',
      args: { query: 'Swagger docs' },
    }),
  );

  const trpcRouter = await computeStartReport(root, {
    intent: 'where is tRPC router for billing',
  });
  expect(trpcRouter.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "billing tRPC router" --format json',
      tool: 'projscan_search',
      args: { query: 'billing tRPC router' },
    }),
  );

  const graphqlResolver = await computeStartReport(root, {
    intent: 'which GraphQL resolver handles invoices',
  });
  expect(graphqlResolver.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invoices GraphQL resolver" --format json',
      tool: 'projscan_search',
      args: { query: 'invoices GraphQL resolver' },
    }),
  );

  const protobufService = await computeStartReport(root, {
    intent: 'which protobuf defines user service',
  });
  expect(protobufService.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "user service protobuf" --format json',
      tool: 'projscan_search',
      args: { query: 'user service protobuf' },
    }),
  );

  const grpcClient = await computeStartReport(root, {
    intent: 'where is gRPC client for payments',
  });
  expect(grpcClient.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "payments gRPC client" --format json',
      tool: 'projscan_search',
      args: { query: 'payments gRPC client' },
    }),
  );

  const dockerfile = await computeStartReport(root, {
    intent: 'where is the Dockerfile',
  });
  expect(dockerfile.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Dockerfile" --format json',
      tool: 'projscan_search',
      args: { query: 'Dockerfile' },
    }),
  );

  const compose = await computeStartReport(root, {
    intent: 'where is docker compose for local dev',
  });
  expect(compose.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "local dev docker compose" --format json',
      tool: 'projscan_search',
      args: { query: 'local dev docker compose' },
    }),
  );

  const kubernetes = await computeStartReport(root, {
    intent: 'where are Kubernetes manifests',
  });
  expect(kubernetes.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Kubernetes manifests" --format json',
      tool: 'projscan_search',
      args: { query: 'Kubernetes manifests' },
    }),
  );

  const helm = await computeStartReport(root, {
    intent: 'find Helm chart for payments',
  });
  expect(helm.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "payments Helm chart" --format json',
      tool: 'projscan_search',
      args: { query: 'payments Helm chart' },
    }),
  );

  const terraform = await computeStartReport(root, {
    intent: 'where is Terraform module for S3',
  });
  expect(terraform.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "S3 Terraform module" --format json',
      tool: 'projscan_search',
      args: { query: 'S3 Terraform module' },
    }),
  );

  const deployWorkflow = await computeStartReport(root, {
    intent: 'which GitHub workflow deploys staging',
  });
  expect(deployWorkflow.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "staging GitHub workflow" --format json',
      tool: 'projscan_search',
      args: { query: 'staging GitHub workflow' },
    }),
  );

  const vercelConfig = await computeStartReport(root, {
    intent: 'where is Vercel config',
  });
  expect(vercelConfig.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "Vercel config" --format json',
      tool: 'projscan_search',
      args: { query: 'Vercel config' },
    }),
  );

  const passwordReset = await computeStartReport(root, {
    intent: 'where is password reset handled',
  });
  expect(passwordReset.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "password reset" --format json',
      tool: 'projscan_search',
      args: { query: 'password reset' },
    }),
  );

  const inviteFlow = await computeStartReport(root, {
    intent: 'where is team invite flow',
  });
  expect(inviteFlow.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "team invite flow" --format json',
      tool: 'projscan_search',
      args: { query: 'team invite flow' },
    }),
  );

  const onboarding = await computeStartReport(root, {
    intent: 'where is onboarding flow implemented',
  });
  expect(onboarding.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "onboarding flow" --format json',
      tool: 'projscan_search',
      args: { query: 'onboarding flow' },
    }),
  );

  const csvExport = await computeStartReport(root, {
    intent: 'find CSV export for users',
  });
  expect(csvExport.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "users CSV export" --format json',
      tool: 'projscan_search',
      args: { query: 'users CSV export' },
    }),
  );

  const auditLog = await computeStartReport(root, {
    intent: 'what creates audit log entries',
  });
  expect(auditLog.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "audit log entries" --format json',
      tool: 'projscan_search',
      args: { query: 'audit log entries' },
    }),
  );

  const refund = await computeStartReport(root, {
    intent: 'where is refund handling for payments',
  });
  expect(refund.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "payments refund handling" --format json',
      tool: 'projscan_search',
      args: { query: 'payments refund handling' },
    }),
  );

  const renewal = await computeStartReport(root, {
    intent: 'where is subscription renewal handled',
  });
  expect(renewal.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "subscription renewal" --format json',
      tool: 'projscan_search',
      args: { query: 'subscription renewal' },
    }),
  );

  const welcomeEmail = await computeStartReport(root, {
    intent: 'where is welcome email template',
  });
  expect(welcomeEmail.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "welcome email template" --format json',
      tool: 'projscan_search',
      args: { query: 'welcome email template' },
    }),
  );

  const resetEmailCopy = await computeStartReport(root, {
    intent: 'find password reset email copy',
  });
  expect(resetEmailCopy.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "password reset email copy" --format json',
      tool: 'projscan_search',
      args: { query: 'password reset email copy' },
    }),
  );

  const pushCopy = await computeStartReport(root, {
    intent: 'where is push notification copy for invites',
  });
  expect(pushCopy.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invites push notification copy" --format json',
      tool: 'projscan_search',
      args: { query: 'invites push notification copy' },
    }),
  );

  const smsTemplate = await computeStartReport(root, {
    intent: 'where is SMS verification template',
  });
  expect(smsTemplate.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "SMS verification template" --format json',
      tool: 'projscan_search',
      args: { query: 'SMS verification template' },
    }),
  );

  const receiptEmail = await computeStartReport(root, {
    intent: 'which template sends receipt email',
  });
  expect(receiptEmail.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "receipt email template" --format json',
      tool: 'projscan_search',
      args: { query: 'receipt email template' },
    }),
  );

  const invoicePdf = await computeStartReport(root, {
    intent: 'where is invoice PDF generated',
  });
  expect(invoicePdf.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan search "invoice PDF" --format json',
      tool: 'projscan_search',
      args: { query: 'invoice PDF' },
    }),
  );
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_understand')).toEqual(
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
  expect(report.missionControl.proofCommands).toContain('projscan file src/core/start.ts --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan semantic-graph --query package_importers --symbol chalk --format json');

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
  expect(packageWord.missionControl.alternatives?.find((route) => route.tool === 'projscan_upgrade')).toBeUndefined();

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
  expect(report.missionControl.proofCommands).toContain('projscan semantic-graph --query symbol_defs --symbol runAudit --format json');
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
  expect(noTests.missionControl.alternatives?.find((route) => route.tool === 'projscan_regression_plan')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_doctor')).toBeUndefined();
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
  expect(report.missionControl.proofCommands).toContain('projscan audit --package lodash --format json');
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_impact')).toEqual(
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim')).toBeUndefined();
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
  expect(report.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim')).toBeUndefined();
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
  expect(ask.missionControl.alternatives?.find((route) => route.tool === 'projscan_claim')).toBeUndefined();
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
      instruction: 'Replace <package-from-outdated> with a package name from projscan outdated or projscan dependencies.',
    },
  ]);
  expect(report.missionControl.whyNow).toContain('run projscan_outdated first');
  expect(report.missionControl.proofCommands).toContain('projscan outdated --format json');
  expect(report.missionControl.proofCommands).not.toContain('projscan upgrade <package-from-outdated> --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan coupling --cycles-only --format json');
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
  expect(report.missionControl.alternatives?.map((route) => route.tool)).toContain('projscan_preflight');
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
  expect(report.coordinationHints[0]?.command).toBe('projscan preflight --mode before_commit --format json');
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
    }),
  );
  expect(report.missionControl.proofCommands[0]).toBe('projscan preflight --mode before_commit --format json');
  expect(report.missionControl.primaryAction.args).toEqual({ mode: 'before_commit' });
  expect(report.missionControl.proofCommands).not.toContain('projscan preflight --mode before_edit --format json');
  const nextActionCommands = report.nextActions
    .map((action) => action.command)
    .filter((command): command is string => typeof command === 'string');
  expect(nextActionCommands).toEqual([...new Set(nextActionCommands)]);
  expect(nextActionCommands.filter((command) => command === 'projscan preflight --mode before_commit --format json')).toHaveLength(1);
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
  expect(report.missionControl.proofCommands).toContain('projscan preflight --mode before_commit --format json');
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
  expect(report.missionControl.proofCommands).toContain('projscan preflight --mode before_merge --format json');
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
  expect(report.missionControl.readyActions.map((action) => action.command)).toContain('projscan bug-hunt --format json');
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
  expect(report.missionControl.readyActions.map((action) => action.command)).toContain('projscan release-train --format json');
  expect(report.firstTenMinutes.commands[2]?.command).toBe('projscan preflight --mode before_merge --format json');

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

  const deployment = await computeStartReport(root, { intent: 'prepare this branch for deployment' });
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
  expect(report.firstTenMinutes.commands[2]?.command).toBe('projscan preflight --mode before_merge --format json');

  const deployCheck = await computeStartReport(root, { intent: 'what should I check before deploy' });
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

  const releaseNote = await computeStartReport(root, { intent: 'write a release note for this change' });

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
  expect(releaseNote.firstTenMinutes.commands[2]?.command).toBe('projscan preflight --mode before_merge --format json');

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

  const sinceRelease = await computeStartReport(root, { intent: 'what changed since last release' });
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
  expect(report.coordinationHints.map((hint) => hint.command)).toContain('projscan session touched --format json');
  expect(report.coordinationHints.find((hint) => hint.id === 'remembered-session-context')?.message).toContain('1 touched file(s)');
});

test('start report exposes a phased execution plan for fuzzy routed intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, resolve 2 input(s), then gather ${report.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(report.missionControl.executionPlan.currentPhase).toBe('next_action');
  expect(report.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      label: 'Find exact target for impact analysis',
      command: 'projscan search "auth token loader" --format json',
      unlocks: ['input-1', 'input-2'],
      reason: 'Run this ready command next; it can unlock later inputs or follow-up steps.',
    }),
  );
  expect(report.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`)).toEqual([
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
  expect(report.missionControl.executionPlan.phases.find((phase) => phase.id === 'ready_now')?.steps[0]).toEqual(
    expect.objectContaining({
      id: 'ready-1',
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(report.missionControl.executionPlan.phases.find((phase) => phase.id === 'resolve_inputs')?.steps).toEqual([
    expect.objectContaining({
      id: 'input-1',
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      dependsOn: ['ready-1'],
      unlocks: ['follow-up-1'],
      instruction: 'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      kind: 'input',
      status: 'blocked',
      label: 'file',
      dependsOn: ['ready-1'],
      unlocks: ['follow-up-2'],
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(report.missionControl.executionPlan.phases.find((phase) => phase.id === 'follow_up')?.steps).toEqual([
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
  expect(report.missionControl.executionPlan.phases.find((phase) => phase.id === 'proof')?.steps.map((step) => step.command)).toEqual(
    report.missionControl.proofCommands,
  );
  expect(report.missionControl.executionPlan.phases.find((phase) => phase.id === 'proof')?.steps[0]).toEqual(
    expect.objectContaining({
      id: 'proof-1',
      kind: 'proof',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(report.missionControl.resume).toEqual(
    expect.objectContaining({
      currentStep: report.missionControl.executionPlan.cursor,
      status: 'ready',
      commandBlock: 'projscan search "auth token loader" --format json',
      instruction: 'Run projscan search "auth token loader" --format json.',
      prompt: 'Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1, input-2.',
    }),
  );
  expect(report.missionControl.handoff.currentStep).toEqual(report.missionControl.executionPlan.cursor);
  expect(report.missionControl.handoff.resume).toEqual(report.missionControl.resume);
  expect(report.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Find exact target for impact analysis',
      status: report.missionControl.status,
      currentPhase: 'next_action',
      currentStep: report.missionControl.executionPlan.cursor,
      resume: report.missionControl.resume,
      readyCommandBlock: 'projscan search "auth token loader" --format json',
      blockedInputSummary: 'Needs input: symbol=<symbol-from-search>, file=<file-from-search>.',
    }),
  );
  expect(report.missionControl.runbook.readyCommandBlock).not.toContain('<');
  expect(report.missionControl.runbook.markdown).toContain('# Mission Runbook');
  expect(report.missionControl.runbook.markdown).toContain('Intent: what breaks if I rename the auth token loader');
  expect(report.missionControl.runbook.markdown).toContain('## Current Cursor');
  expect(report.missionControl.runbook.markdown).toContain('- Step: ready-1 in ready_now');
  expect(report.missionControl.runbook.markdown).toContain('- Command: `projscan search "auth token loader" --format json`');
  expect(report.missionControl.runbook.markdown).toContain('- Unlocks: input-1, input-2');
  expect(report.missionControl.runbook.markdown).toContain('- Why: Run this ready command next; it can unlock later inputs or follow-up steps.');
  expect(report.missionControl.runbook.markdown).toContain('## Resume');
  expect(report.missionControl.runbook.markdown).toContain('Run now:');
  expect(report.missionControl.runbook.markdown).toContain('```sh\nprojscan search "auth token loader" --format json\n```');
  expect(report.missionControl.runbook.markdown).toContain('Prompt: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1, input-2.');
  expect(report.missionControl.runbook.markdown).toContain('- `projscan search "auth token loader" --format json`');
  expect(report.missionControl.runbook.markdown).toContain('- symbol: Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(report.missionControl.runbook.markdown).toContain('- An exact symbol or file path is selected from search results before impact analysis continues.');
});

test('start report exposes an unblocked execution plan for direct safety-gate intents', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is it safe to commit this change',
  });

  expect(report.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, then gather ${report.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(report.missionControl.executionPlan.currentPhase).toBe('next_action');
  expect(report.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      command: 'projscan preflight --mode before_commit --format json',
      reason: 'Run this ready command next.',
    }),
  );
  expect(report.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`)).toEqual([
    'next_action:ready',
    'ready_now:ready',
    'proof:ready',
    'done_when:pending',
  ]);
  expect(report.missionControl.executionPlan.phases.some((phase) => phase.id === 'resolve_inputs')).toBe(false);
  expect(report.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'tool',
      status: 'ready',
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    }),
  );
  expect(report.missionControl.executionPlan.phases.find((phase) => phase.id === 'done_when')?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'criterion',
      status: 'pending',
      label: 'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
    }),
  );
  expect(report.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Use projscan_preflight for is it safe to commit this change',
      status: report.missionControl.status,
      currentPhase: 'next_action',
      readyCommandBlock: 'projscan preflight --mode before_commit --format json',
    }),
  );
  expect(report.missionControl.runbook.blockedInputSummary).toBeUndefined();
  expect(report.missionControl.runbook.markdown).toContain('- `projscan preflight --mode before_commit --format json`');
  expect(report.missionControl.runbook.markdown).not.toContain('## Blocked Inputs');
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
