import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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
