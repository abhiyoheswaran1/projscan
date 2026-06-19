import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report marks default mode when neither mode nor mode-specific intent is supplied', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.mode).toBe('before_edit');
  expect(report.modeSource).toBe('default');
  expect(report.modeReason).toContain('No mode-specific intent');
});

test('start report makes the default before-edit preflight command explicit', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_edit --format json',
    }),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(report.missionControl.proofCommands).not.toContain('projscan preflight --format json');
});

test('start report exposes three trusted daily workflows before broad onboarding', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.dailyWorkflows.map((workflow) => workflow.id)).toEqual([
    'before_edit',
    'before_handoff',
    'release_candidate_review',
  ]);
  expect(report.dailyWorkflows[0]).toEqual(
    expect.objectContaining({
      name: 'Before editing a feature',
      commands: [
        'projscan start --intent "what files do I need to change for auth?"',
        'projscan understand --view change --intent "add auth token refresh" --format json',
        'projscan preflight --mode before_edit --format json',
      ],
      successCriteria: expect.arrayContaining(['Agent has cited change context before editing.']),
    }),
  );
  expect(report.dailyWorkflows[1].commands).toEqual([
    'projscan bug-hunt --format json',
    'projscan preflight --mode before_commit --format json',
    'projscan evidence-pack --pr-comment',
  ]);
  expect(report.dailyWorkflows[2].commands).toEqual([
    'projscan release-train --format json',
    'projscan preflight --mode before_merge --format json',
    'projscan evidence-pack --pr-comment',
  ]);
  expect(report.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
});

test('start report keeps optional plugin info out of adoption gaps', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root);

  expect(report.setup.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'plugins',
        status: 'info',
      }),
    ]),
  );
  expect(report.adoptionGaps.map((gap) => gap.id)).not.toContain('plugins');
});
