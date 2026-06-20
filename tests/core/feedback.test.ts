import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  addFeedbackResponse,
  classifyFeedbackIntake,
  createFeedbackTemplate,
  readFeedbackFile,
  summarizeFeedbackFile,
} from '../../src/index.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-feedback-core-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('feedback template writes the repeat-use evidence questions and refuses accidental overwrite', async () => {
  const file = path.join(tmp, '.projscan-feedback.json');

  const created = await createFeedbackTemplate(file);

  expect(created.path).toBe(file);
  expect(created.responses).toHaveLength(0);
  expect(created.instructions).toEqual(
    expect.arrayContaining([
      'Record one response per real PR review.',
      'Run projscan feedback summary --file ' + file + ' --format json before dogfood.',
    ]),
  );
  const saved = await readFeedbackFile(file);
  expect(saved.schemaVersion).toBe(1);
  expect(saved.questions).toContain('How many minutes did projscan save on this PR?');

  await expect(createFeedbackTemplate(file)).rejects.toThrow(/already exists/);
  await expect(createFeedbackTemplate(file, { force: true })).resolves.toMatchObject({
    path: file,
  });
});

test('feedback add and summary track minutes saved, prevented bad edits, false positives, and repeat use', async () => {
  const file = path.join(tmp, '.projscan-feedback.json');
  await createFeedbackTemplate(file);

  await addFeedbackResponse(file, {
    repo: 'api',
    pr: 'https://github.com/acme/api/pull/1',
    reviewer: '@alice',
    useful: true,
    minutesSaved: 12,
    preventedBadEdit: false,
    ownerRoutingClear: true,
    nextCommandClear: true,
  });
  await addFeedbackResponse(file, {
    repo: 'api',
    pr: 'https://github.com/acme/api/pull/2',
    reviewer: '@bob',
    useful: true,
    minutesSaved: 18,
    preventedBadEdit: true,
    ownerRoutingClear: true,
    nextCommandClear: true,
    falsePositiveRules: ['route-owner:vague'],
    missingSignals: ['auth middleware was not identified'],
    noisyFindings: ['generated route warning'],
  });
  await addFeedbackResponse(file, {
    repo: 'web',
    pr: 'https://github.com/acme/web/pull/3',
    reviewer: '@carol',
    useful: false,
    minutesSaved: 0,
    preventedBadEdit: false,
    ownerRoutingClear: false,
    nextCommandClear: true,
  });

  const summary = await summarizeFeedbackFile(file);

  expect(summary.responses).toBe(3);
  expect(summary.usefulResponses).toBe(2);
  expect(summary.distinctRepos).toBe(2);
  expect(summary.distinctPrs).toBe(3);
  expect(summary.repeatUse.repeatedRepos).toBe(1);
  expect(summary.repeatUse.ready).toBe(true);
  expect(summary.minutesSaved.total).toBe(30);
  expect(summary.minutesSaved.average).toBe(10);
  expect(summary.preventedBadEdits).toBe(1);
  expect(summary.falsePositive.totalReports).toBe(1);
  expect(summary.falsePositive.noisyRules[0]).toEqual({ rule: 'route-owner:vague', count: 1 });
  expect(summary.nextDogfoodCommand).toBe('projscan dogfood --feedback ' + file + ' --format json');
});

test('feedback intake classifies raw agent and reviewer feedback into fix candidates', () => {
  const falsePositive = classifyFeedbackIntake(
    'unused-exports false positives: imports through @/ path aliases are flagged unused in a Next.js app',
  );

  expect(falsePositive).toMatchObject({
    category: 'false_positive',
    confidence: 'high',
    taskTitle: 'Fix false-positive feedback: unused-exports',
    suggestedCommand:
      'npm test -- tests/analyzers/deadCodeCheck.test.ts tests/core/importGraph.test.ts',
  });
  expect(falsePositive.agentloopTaskCommand).toContain(
    'npm exec agentloop -- create-task --type bugfix',
  );
  expect(falsePositive.agentloopTaskCommand).toContain(
    "--title 'Fix false-positive feedback: unused-exports'",
  );
  expect(falsePositive.agentloopTaskCommand).toContain('--problem');
  expect(falsePositive.agentloopTaskCommand).toContain('--outcome');
  expect(falsePositive.agentloopTaskCommand).toContain(
    "--verify-command 'npm test -- tests/analyzers/deadCodeCheck.test.ts tests/core/importGraph.test.ts'",
  );
  expect(falsePositive.nextCommand).toBe(falsePositive.agentloopTaskCommand);
  expect(falsePositive.followUpCommands).toEqual(
    expect.arrayContaining([
      falsePositive.agentloopTaskCommand,
      'npm test -- tests/analyzers/deadCodeCheck.test.ts tests/core/importGraph.test.ts',
    ]),
  );

  expect(
    classifyFeedbackIntake('caution output is becoming noisy background noise in every PR'),
  ).toMatchObject({
    category: 'noisy_caution',
    confidence: 'high',
    taskTitle: 'Reduce noisy caution output',
    suggestedCommand:
      'npm test -- tests/core/preflight*.test.ts tests/core/releaseEvidence.test.ts',
  });

  expect(
    classifyFeedbackIntake('Koa ctx.request.body is not detected as a framework request source'),
  ).toMatchObject({
    category: 'missing_framework_rule',
    taskTitle: 'Add missing framework rule: Koa',
  });

  expect(
    classifyFeedbackIntake(
      'The docs sound bigger than the demonstrated workflow and the output wording is confusing',
    ),
  ).toMatchObject({
    category: 'confusing_docs_output',
    taskTitle: 'Clarify confusing docs or output',
  });

  expect(
    classifyFeedbackIntake('This evidence pack was useful and saved the reviewer 20 minutes'),
  ).toMatchObject({
    category: 'useful_signal',
    taskTitle: 'Preserve useful feedback signal',
  });
});
