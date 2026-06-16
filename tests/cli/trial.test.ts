import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;
let repoA: string;
let repoB: string;
let repoC: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-trial-'));
  repoA = await makeRepo('api');
  repoB = await makeRepo('web');
  repoC = await makeRepo('worker');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('trial renders one JSON adoption-readiness report from repos and feedback', async () => {
  const feedbackPath = path.join(tmp, '.projscan-feedback.json');
  await fs.writeFile(
    feedbackPath,
    JSON.stringify(
      {
        responses: [
          feedback('api', 'https://github.com/acme/api/pull/1', 12, true),
          feedback('api', 'https://github.com/acme/api/pull/2', 10, false),
          feedback('web', 'https://github.com/acme/web/pull/3', 10, false),
          feedback('worker', 'https://github.com/acme/worker/pull/4', 9, true),
        ],
      },
      null,
      2,
    ) + '\n',
  );

  const result = await runCli([
    'trial',
    '--repo',
    repoA,
    '--repo',
    repoB,
    '--repo',
    repoC,
    '--target-repos',
    '3',
    '--feedback',
    feedbackPath,
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.verdict).toBe('adopt');
  expect(report.decision.adoptable).toBe(true);
  expect(report.feedback.responses).toBe(4);
  expect(report.dogfood.marketValidation.repeatUse.ready).toBe(true);
  expect(report.websiteProof.markdown).toContain('41 minutes saved');
});

function feedback(repo: string, pr: string, minutesSaved: number, preventedBadEdit: boolean) {
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
  const root = path.join(tmp, name);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.0.0',
        type: 'module',
        devDependencies: { eslint: '^9.0.0', prettier: '^3.0.0', vitest: '^3.0.0' },
      },
      null,
      2,
    ) + '\n',
  );
  await fs.writeFile(
    path.join(root, 'README.md'),
    '# ' + name + '\n\nA representative trial fixture with setup instructions and usage notes.\n',
  );
  await fs.writeFile(
    path.join(root, '.eslintrc.json'),
    JSON.stringify({ root: true }, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(root, '.prettierrc'),
    JSON.stringify({ singleQuote: true }, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(root, '.editorconfig'),
    'root = true\n[*]\nindent_style = space\nindent_size = 2\n',
  );
  await fs.writeFile(path.join(root, '.gitignore'), 'node_modules/\n.env\n');
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
