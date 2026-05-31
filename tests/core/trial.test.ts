import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { computeTrialReport } from '../../src/index.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('trial report marks a product trial adoptable when repo, feedback, value, and repeat-use proof are ready', async () => {
  const repos = [
    await makeRepo('api-service'),
    await makeRepo('web-app'),
    await makeRepo('worker'),
  ];

  const report = await computeTrialReport(process.cwd(), {
    repos,
    targetRepoCount: 3,
    feedbackPath: '.projscan-feedback.json',
    feedback: {
      responses: [
        usefulFeedback('api-service', 'https://github.com/acme/api-service/pull/42', 15, true),
        usefulFeedback('api-service', 'https://github.com/acme/api-service/pull/43', 7, false),
        usefulFeedback('web-app', 'https://github.com/acme/web-app/pull/17', 10, false),
        usefulFeedback('worker', 'https://github.com/acme/worker/pull/9', 20, true),
      ],
    },
  });

  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.verdict).toBe('adopt');
  expect(report.activation.status).toBe('pass');
  expect(report.activation.healthScore).toBeGreaterThanOrEqual(90);
  expect(report.dogfood.marketValidation.status).toBe('proven');
  expect(report.feedback?.repeatUse.ready).toBe(true);
  expect(report.decision.adoptable).toBe(true);
  expect(report.decision.reasons).toContain('trial is adoption-ready');
  expect(report.websiteProof.markdown).toContain('52 minutes saved');
  expect(report.nextCommands.map((action) => action.command)).toContain(
    'projscan evidence-pack --pr-comment',
  );
});

test('trial report stays in pilot mode until reviewer feedback proves value and repeat use', async () => {
  const repo = await makeRepo('api-service');

  const report = await computeTrialReport(process.cwd(), {
    repos: [repo],
    targetRepoCount: 1,
  });

  expect(report.verdict).toBe('pilot');
  expect(report.dogfood.marketValidation.status).toBe('needs_feedback');
  expect(report.decision.adoptable).toBe(false);
  expect(report.decision.reasons).toContain('reviewer feedback has not been captured');
  expect(report.nextCommands.map((action) => action.command)).toEqual(
    expect.arrayContaining([
      'projscan feedback init --output .projscan-feedback.json',
      'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
    ]),
  );
});

function usefulFeedback(repo: string, pr: string, minutesSaved: number, preventedBadEdit: boolean) {
  return {
    repo,
    pr,
    reviewer: '@reviewer',
    useful: true,
    minutesSaved,
    preventedBadEdit,
    ownerRoutingClear: true,
    nextCommandClear: true,
    falsePositiveRules: [],
    missingSignals: [],
    noisyFindings: [],
  };
}

async function makeRepo(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-trial-' + name + '-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name, version: '0.0.0', type: 'module', devDependencies: { eslint: '^9.0.0', prettier: '^3.0.0', vitest: '^3.0.0' } }, null, 2) + '\n',
  );
  await fs.writeFile(path.join(root, 'README.md'), '# ' + name + '\n\nA representative trial fixture with setup instructions and usage notes.\n');
  await fs.writeFile(path.join(root, '.eslintrc.json'), JSON.stringify({ root: true }, null, 2) + '\n');
  await fs.writeFile(path.join(root, '.prettierrc'), JSON.stringify({ singleQuote: true }, null, 2) + '\n');
  await fs.writeFile(path.join(root, '.editorconfig'), 'root = true\n[*]\nindent_style = space\nindent_size = 2\n');
  await fs.writeFile(path.join(root, '.gitignore'), 'node_modules/\n.env\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
