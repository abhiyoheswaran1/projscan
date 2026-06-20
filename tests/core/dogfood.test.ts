import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeDogfoodReport } from '../../src/index.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('dogfood report evaluates multiple repos and tells teams what is still missing', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
    await makeRepo('admin'),
    await makeRepo('jobs'),
  ];

  const report = await computeDogfoodReport(process.cwd(), { repos, targetRepoCount: 5 });

  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.summary).toContain('5 repo');
  expect(report.targetRepoCount).toBe(5);
  expect(report.repos).toHaveLength(5);
  expect(report.totals.reposEvaluated).toBe(5);
  expect(report.totals.prCommentReady).toBe(5);
  expect(report.totals.repeatUseReady).toBe(5);
  expect(report.repos[0].feedbackQuestions).toEqual(
    expect.arrayContaining([
      'Did the PR comment save 10-20 minutes?',
      'What was missing or noisy?',
    ]),
  );
  expect(report.suggestedNextActions.map((action) => action.command)).toEqual(
    expect.arrayContaining(['projscan dogfood --repo <path-to-repo> --format json']),
  );
});

test('dogfood next actions distinguish first-PR evidence from feedback capture', async () => {
  const repo = await makeRepo('api-service');

  const report = await computeDogfoodReport(process.cwd(), { repos: [repo], targetRepoCount: 3 });
  const evidenceIndex = report.suggestedNextActions.findIndex(
    (action) => action.command === 'projscan evidence-pack --pr-comment',
  );
  const feedbackCommand =
    'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10';
  const feedbackIndex = report.suggestedNextActions.findIndex(
    (action) => action.command === feedbackCommand,
  );

  expect(evidenceIndex).toBeGreaterThanOrEqual(0);
  expect(feedbackIndex).toBeGreaterThanOrEqual(0);
  expect(report.suggestedNextActions[evidenceIndex]).toEqual(
    expect.objectContaining({
      label: 'Generate first-PR evidence for review',
      command: 'projscan evidence-pack --pr-comment',
    }),
  );
  expect(report.suggestedNextActions[feedbackIndex]).toEqual(
    expect.objectContaining({
      label: 'Capture reviewer feedback as structured evidence',
      command: feedbackCommand,
    }),
  );
  expect(evidenceIndex).toBeLessThan(feedbackIndex);
});

test('dogfood report rolls reviewer feedback into market validation and website proof', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
  ];

  const report = await computeDogfoodReport(process.cwd(), {
    repos,
    targetRepoCount: 3,
    feedback: {
      responses: [
        {
          repo: 'api-service',
          pr: 'https://github.com/acme/api-service/pull/42',
          reviewer: '@platform-reviewer',
          useful: true,
          minutesSaved: 15,
          preventedBadEdit: true,
          ownerRoutingClear: true,
          nextCommandClear: true,
          falsePositiveRules: [],
          missingSignals: ['none'],
          noisyFindings: ['none'],
        },
        {
          repo: 'api-service',
          pr: 'https://github.com/acme/api-service/pull/43',
          reviewer: '@platform-reviewer',
          useful: true,
          minutesSaved: 7,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: true,
          falsePositiveRules: [],
          missingSignals: [],
          noisyFindings: [],
        },
        {
          repo: 'web-app',
          pr: 'https://github.com/acme/web-app/pull/17',
          reviewer: '@frontend-reviewer',
          useful: true,
          minutesSaved: 10,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: true,
          falsePositiveRules: ['dead-code:generated-barrel'],
          missingSignals: ['route owner was implied but not named'],
          noisyFindings: ['generated barrel export warning'],
        },
        {
          repo: 'worker',
          pr: 'https://github.com/acme/worker/pull/9',
          reviewer: '@backend-reviewer',
          useful: true,
          minutesSaved: 20,
          preventedBadEdit: true,
          ownerRoutingClear: true,
          nextCommandClear: true,
          falsePositiveRules: [],
          missingSignals: ['none'],
          noisyFindings: ['none'],
        },
      ],
    },
  });

  expect(report.marketValidation.status).toBe('proven');
  expect(report.marketValidation.feedback.responses).toBe(4);
  expect(report.marketValidation.feedback.usefulResponses).toBe(4);
  expect(report.marketValidation.feedback.minutesSaved.total).toBe(52);
  expect(report.marketValidation.feedback.preventedBadEdits).toBe(2);
  expect(report.marketValidation.value.ready).toBe(true);
  expect(report.marketValidation.repeatUse.ready).toBe(true);
  expect(report.marketValidation.repeatUse.distinctPrs).toBe(4);
  expect(report.marketValidation.repeatUse.repeatedRepos).toBe(1);
  expect(report.marketValidation.falsePositive.totalReports).toBe(1);
  expect(report.marketValidation.falsePositive.noisyRules[0]).toEqual({
    rule: 'dead-code:generated-barrel',
    count: 1,
  });
  expect(report.marketValidation.websiteProof.markdown).toContain('3 real repo(s)');
  expect(report.marketValidation.websiteProof.markdown).toContain('52 minutes saved');
  expect(report.marketValidation.websiteProof.markdown).toContain('2 risky edits prevented');
  expect(report.marketValidation.websiteProof.markdown).toContain(
    '1 repo(s) with repeat PR feedback',
  );
  expect(report.marketValidation.nextProofStep).toBe('Adoption proof is ready for public claims.');
  expect(report.marketValidation.proofGates.every((gate) => gate.status === 'pass')).toBe(true);
  expect(report.repos[1].validation.falsePositiveRules).toContain('dead-code:generated-barrel');
  expect(report.suggestedNextActions.map((action) => action.command)).toContain(
    'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
  );
});

test('dogfood requires measured value and repeat PR use before market validation is proven', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
  ];

  const report = await computeDogfoodReport(process.cwd(), {
    repos,
    targetRepoCount: 3,
    feedback: {
      responses: [
        {
          repo: 'api-service',
          pr: 'https://github.com/acme/api-service/pull/1',
          reviewer: '@platform-reviewer',
          useful: true,
          minutesSaved: 5,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: true,
        },
        {
          repo: 'web-app',
          pr: 'https://github.com/acme/web-app/pull/2',
          reviewer: '@frontend-reviewer',
          useful: true,
          minutesSaved: 5,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: true,
        },
        {
          repo: 'worker',
          pr: 'https://github.com/acme/worker/pull/3',
          reviewer: '@backend-reviewer',
          useful: true,
          minutesSaved: 5,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: true,
        },
      ],
    },
  });

  expect(report.marketValidation.status).toBe('needs_tuning');
  expect(report.marketValidation.value.ready).toBe(false);
  expect(report.marketValidation.repeatUse.ready).toBe(false);
  expect(report.marketValidation.summary).toContain('0 repo(s) with repeat PR feedback');
  expect(report.marketValidation.nextProofStep).toBe(
    'Capture repeat PR feedback in at least 1 repo(s).',
  );
  expect(report.marketValidation.proofGates.find((gate) => gate.id === 'repeat-use')?.status).toBe(
    'fail',
  );
  expect(report.marketValidation.websiteProof.headline).toContain('needs tuning');
});

test('dogfood requires at least three useful reviewer responses before market validation is proven', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
  ];

  const report = await computeDogfoodReport(process.cwd(), {
    repos,
    targetRepoCount: 3,
    feedback: {
      responses: [
        {
          repo: 'api-service',
          reviewer: '@platform-reviewer',
          useful: true,
          minutesSaved: 15,
          preventedBadEdit: true,
          ownerRoutingClear: true,
          nextCommandClear: true,
          falsePositiveRules: [],
          missingSignals: [],
          noisyFindings: [],
        },
      ],
    },
  });

  expect(report.marketValidation.status).toBe('needs_tuning');
  expect(report.marketValidation.nextProofStep).toBe(
    'Collect at least 2 more useful reviewer response(s).',
  );
  expect(
    report.marketValidation.proofGates.find((gate) => gate.id === 'useful-feedback')?.status,
  ).toBe('fail');
  expect(report.marketValidation.websiteProof.headline).not.toContain('proved useful');
});

test('dogfood website proof copy stays provisional until feedback proves usefulness', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
  ];

  const needsFeedback = await computeDogfoodReport(process.cwd(), { repos, targetRepoCount: 3 });

  expect(needsFeedback.marketValidation.status).toBe('needs_feedback');
  expect(needsFeedback.marketValidation.nextProofStep).toBe(
    'Capture structured reviewer feedback from the first real PR.',
  );
  expect(
    needsFeedback.marketValidation.proofGates.find((gate) => gate.id === 'reviewer-feedback')
      ?.status,
  ).toBe('fail');
  expect(needsFeedback.marketValidation.websiteProof.headline).toContain('needs reviewer feedback');
  expect(needsFeedback.marketValidation.websiteProof.markdown).not.toContain(
    'proved useful across',
  );

  const needsTuning = await computeDogfoodReport(process.cwd(), {
    repos,
    targetRepoCount: 3,
    feedback: {
      responses: [
        {
          repo: 'api-service',
          reviewer: '@platform-reviewer',
          useful: true,
          minutesSaved: 10,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: true,
          falsePositiveRules: ['dead-code:generated-barrel', 'owner-routing:missing'],
          missingSignals: ['security owner missing'],
          noisyFindings: ['generated barrel warning'],
        },
        {
          repo: 'web-app',
          reviewer: '@frontend-reviewer',
          useful: false,
          minutesSaved: 0,
          preventedBadEdit: false,
          ownerRoutingClear: false,
          nextCommandClear: true,
          falsePositiveRules: ['route-owner:vague'],
          missingSignals: ['route owner unclear'],
          noisyFindings: ['manual review was too vague'],
        },
        {
          repo: 'worker',
          reviewer: '@backend-reviewer',
          useful: false,
          minutesSaved: 0,
          preventedBadEdit: false,
          ownerRoutingClear: true,
          nextCommandClear: false,
          falsePositiveRules: [],
          missingSignals: ['next command missing'],
          noisyFindings: [],
        },
      ],
    },
  });

  expect(needsTuning.marketValidation.status).toBe('needs_tuning');
  expect(needsTuning.marketValidation.websiteProof.headline).toContain('needs tuning');
  expect(needsTuning.marketValidation.websiteProof.markdown).not.toContain('proved useful across');
});

async function makeRepo(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dogfood-' + name + '-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name, version: '0.0.0', type: 'module' }, null, 2) + '\n',
  );
  await fs.writeFile(path.join(root, 'README.md'), '# ' + name + '\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
