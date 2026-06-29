import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { computeProve } from '../../src/core/prove.js';
import { computeReviewGate } from '../../src/core/reviewGate.js';
import type { ProofRecipeConfig } from '../../src/types.js';

const execFileAsync = promisify(execFile);

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let tmp: string;

const proofRecipes: ProofRecipeConfig[] = [
  {
    id: 'billing-retry-safety',
    matches: ['src/billing/**'],
    requiredCommands: ['npm run test:billing'],
    requiredReviewers: ['@billing-platform'],
    forbiddenFiles: ['src/billing/paymentGateway.ts'],
    riskSurface: 'billing',
    reason: 'Billing retry changes need focused regression proof and platform review.',
  },
];

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-gate-'));
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

test('needs-proof gate itemizes proof debt and next commands', async () => {
  await changeBillingRetryPolicy();

  const report = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
    outputPassportPath: '.projscan/passport.json',
    proofRecipes,
  });

  expect(report.kind).toBe('review-gate');
  expect(report.status).toBe('needs-proof');
  expect(report.decision.allowReview).toBe(false);
  expect(report.proofDebt.total).toBeGreaterThan(0);
  expect(report.proofDebt.items.map((item) => item.kind)).toContain('missing-proof');
  expect(report.proofDebt.items.map((item) => item.command)).toContain('npm run test:billing');
  expect(report.recontract.required).toBe(false);
  expect(report.requiredReviewers).toContain('@billing-platform');
  expect(report.nextCommands).toContain('npm run test:billing');
  expect(report.nextCommands).toContain(
    'projscan review-gate --contract .projscan/proof-contract.json --pr-comment',
  );
  expect(report.prComment.markdown).toContain('## Projscan Review Gate');
  expect(report.prComment.markdown).toContain('Proof debt');
});

test('ready gate allows review after matching proof evidence is recorded', async () => {
  await changeBillingRetryPolicy();
  const contract = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
    proofRecipes,
  });
  expect(contract.artifacts.contractPath).toBe('.projscan/proof-contract.json');

  const proofCommands = [
    ...new Set([
      ...contract.proofBroker.requiredProof.flatMap((row) => row.requiredCommands),
      ...contract.proofBroker.proof.missingCommands,
    ]),
  ];
  expect(proofCommands.length).toBeGreaterThan(0);
  for (const command of proofCommands) {
    await computeProve(tmp, {
      recordCommand: command,
      exitCode: 0,
      durationMs: 42,
      summary: 'billing retry proof passed',
      recordSource: 'external',
    });
  }

  const report = await computeReviewGate(tmp, {
    contractPath: '.projscan/proof-contract.json',
    proofRecipes,
  });

  expect(report.status).toBe('ready');
  expect(report.decision.allowReview).toBe(true);
  expect(report.proofDebt.total).toBe(0);
  expect(report.recontract.required).toBe(false);
});

test('drifted gate requires recontract when files leave the approved boundary', async () => {
  await changeBillingRetryPolicy();
  const contractPath = '.projscan/proof-contracts/billing-retry.json';
  const contract = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: contractPath,
    proofRecipes,
  });
  expect(contract.artifacts.contractPath).toBe(contractPath);

  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');

  const report = await computeReviewGate(tmp, {
    contractPath,
    proofRecipes,
  });

  expect(report.status).toBe('drifted');
  expect(report.decision.allowReview).toBe(false);
  expect(report.recontract.required).toBe(true);
  expect(report.recontract.command).toBe(
    'projscan prove --intent "<change intent>" --save-contract .projscan/proof-contracts/billing-retry.json',
  );
  expect(report.recontract.driftFiles).toContain('package.json');
  expect(report.proofDebt.items).toEqual(
    expect.arrayContaining([expect.objectContaining({ kind: 'scope-drift', file: 'package.json' })]),
  );
  expect(report.nextCommands).toContain(
    'projscan review-gate --contract .projscan/proof-contracts/billing-retry.json --pr-comment',
  );
});

test('writes only review gate artifacts under allowed projscan paths', async () => {
  await changeBillingRetryPolicy();

  const report = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
    outputPath: '.projscan/review-gate.json',
    proofRecipes,
  });

  const saved = JSON.parse(await fs.readFile(path.join(tmp, '.projscan/review-gate.json'), 'utf-8'));
  expect(saved.kind).toBe('review-gate');
  expect(report.artifacts.reviewGatePath).toBe('.projscan/review-gate.json');

  await fs.writeFile(path.join(tmp, '.projscan/review-gate.json'), '{"kind":"other"}\n');
  await expect(
    computeReviewGate(tmp, { outputPath: '.projscan/review-gate.json', proofRecipes }),
  ).rejects.toThrow(/Refusing to overwrite/);
  await expect(
    computeReviewGate(tmp, { outputPath: '../review-gate.json', proofRecipes }),
  ).rejects.toThrow(/must stay inside/);

  await fs.mkdir(path.join(tmp, '.projscan/review-gates'), { recursive: true });
  await fs.symlink(
    path.join(tmp, 'package.json'),
    path.join(tmp, '.projscan/review-gates/link.json'),
  );
  await expect(
    computeReviewGate(tmp, { outputPath: '.projscan/review-gates/link.json', proofRecipes }),
  ).rejects.toThrow(/symlinks/);
});

async function changeBillingRetryPolicy(): Promise<void> {
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
}

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
