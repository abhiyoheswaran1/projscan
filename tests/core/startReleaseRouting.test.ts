import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

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

  const builtSinceRelease = await computeStartReport(root, {
    intent: 'what have you built since the last release',
  });
  expect(builtSinceRelease.mode).toBe('release');
  expect(builtSinceRelease.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['built', 'since', 'release']),
    }),
  );

  const versionCandidate = await computeStartReport(root, {
    intent: 'is it worth cutting a version',
  });
  expect(versionCandidate.mode).toBe('release');
  expect(versionCandidate.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_release_train',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['cutting', 'version']),
    }),
  );
});
