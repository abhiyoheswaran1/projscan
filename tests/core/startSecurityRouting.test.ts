import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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
