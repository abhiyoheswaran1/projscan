import { expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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
