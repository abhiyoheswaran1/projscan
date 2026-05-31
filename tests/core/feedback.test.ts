import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { addFeedbackResponse, createFeedbackTemplate, readFeedbackFile, summarizeFeedbackFile } from '../../src/index.js';

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
  await expect(createFeedbackTemplate(file, { force: true })).resolves.toMatchObject({ path: file });
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
