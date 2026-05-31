import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeDogfoodReport } from '../../src/index.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
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
  expect(report.marketValidation.feedback.responses).toBe(3);
  expect(report.marketValidation.feedback.usefulResponses).toBe(3);
  expect(report.marketValidation.feedback.minutesSaved.total).toBe(45);
  expect(report.marketValidation.feedback.preventedBadEdits).toBe(2);
  expect(report.marketValidation.falsePositive.totalReports).toBe(1);
  expect(report.marketValidation.falsePositive.noisyRules[0]).toEqual({
    rule: 'dead-code:generated-barrel',
    count: 1,
  });
  expect(report.marketValidation.websiteProof.markdown).toContain('3 real repo(s)');
  expect(report.marketValidation.websiteProof.markdown).toContain('45 minutes saved');
  expect(report.marketValidation.websiteProof.markdown).toContain('2 risky edits prevented');
  expect(report.repos[1].validation.falsePositiveRules).toContain('dead-code:generated-barrel');
  expect(report.suggestedNextActions.map((action) => action.command)).toContain(
    'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
  );
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
  expect(needsFeedback.marketValidation.websiteProof.headline).toContain('needs reviewer feedback');
  expect(needsFeedback.marketValidation.websiteProof.markdown).not.toContain('proved useful across');

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
