import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { computeProofBroker } from '../../src/core/proofBroker.js';

const execFileAsync = promisify(execFile);

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-broker-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'billing-fixture',
        version: '1.0.0',
        type: 'module',
        scripts: {
          test: 'vitest run tests/billing/retryPolicy.test.ts',
          'test:billing': 'vitest run tests/billing/retryPolicy.test.ts',
          typecheck: 'tsc --noEmit',
        },
        devDependencies: { typescript: '^5.0.0', vitest: '^3.0.0' },
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/billing'), { recursive: true });
  await fs.mkdir(path.join(tmp, 'tests/billing'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/billing/retryPolicy.ts'),
    [
      'export function nextRetryDelay(attempt: number): number {',
      '  return Math.min(attempt * 1000, 5000);',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(tmp, 'tests/billing/retryPolicy.test.ts'),
    [
      "import { nextRetryDelay } from '../../src/billing/retryPolicy.js';",
      '',
      "test('caps retry delay', () => {",
      '  expect(nextRetryDelay(9)).toBe(5000);',
      '});',
      '',
    ].join('\n'),
  );
  await git(['init']);
  await git(['config', 'user.email', 'projscan@example.test']);
  await git(['config', 'user.name', 'Projscan Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'initial billing retry']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('brokers missing billing retry proof into a reviewer-ready PR Passport', async () => {
  await fs.writeFile(
    path.join(tmp, 'src/billing/retryPolicy.ts'),
    [
      'export function nextRetryDelay(attempt: number): number {',
      '  const exponential = 2 ** Math.max(attempt - 1, 0) * 250;',
      '  return Math.min(exponential, 8000);',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProofBroker(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
    outputPassportPath: '.projscan/passport.json',
    proofRecipes: [
      {
        id: 'billing-retry-safety',
        matches: ['src/billing/**'],
        requiredCommands: ['npm run test:billing', 'npm run typecheck'],
        requiredReviewers: ['@billing-platform'],
        forbiddenFiles: ['src/billing/paymentGateway.ts'],
        riskSurface: 'billing',
        reason: 'Billing retry changes need focused regression proof and platform review.',
      },
    ],
  });

  expect(report.kind).toBe('proof-broker');
  expect(report.status).toBe('needs-proof');
  expect(report.reviewer.action).toBe('run-proof');
  expect(report.scope.changedFiles).toContain('src/billing/retryPolicy.ts');
  expect(report.scope.riskyChangedFiles).toContain('src/billing/retryPolicy.ts');
  expect(report.requiredReviewers).toEqual(['@billing-platform']);
  expect(report.requiredProof).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'recipe:billing-retry-safety',
        source: 'recipe',
        status: 'missing',
        requiredCommands: ['npm run test:billing', 'npm run typecheck'],
        requiredReviewers: ['@billing-platform'],
      }),
    ]),
  );
  expect(report.gaps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'missing-proof',
        command: 'npm run test:billing',
        requirementId: 'recipe:billing-retry-safety',
      }),
    ]),
  );
  expect(report.nextCommands).toEqual(
    expect.arrayContaining([
      'npm run test:billing',
      'npm run typecheck',
      'projscan proof-broker --contract .projscan/proof-contract.json --pr-comment',
    ]),
  );
  expect(report.artifacts.passportPath).toBe('.projscan/passport.json');
  expect(report.prPassport.title).toBe('Projscan PR Passport');
  expect(report.prPassport.sections).toEqual([
    'reviewer',
    'scope',
    'required-proof',
    'gaps',
    'reviewers',
    'next-commands',
    'artifacts',
  ]);
  expect(report.prPassport.markdown).toContain('## Projscan PR Passport');
  expect(report.prPassport.markdown).toContain('Reviewer action');
  expect(report.prPassport.markdown).toContain('recipe:billing-retry-safety');
  expect(report.prPassport.markdown).toContain('@billing-platform');
  expect(report.prPassport.markdown).toContain('`.projscan/passport.json`');
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
