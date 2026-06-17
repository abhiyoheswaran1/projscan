import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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
