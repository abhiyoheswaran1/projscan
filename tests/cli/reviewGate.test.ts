import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;
let linkedWorktreePath: string;

function canonicalPath(value: string): string {
  try {
    return fsSync.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-review-gate-'));
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
  await fs.writeFile(
    path.join(tmp, '.projscanrc.json'),
    `${JSON.stringify(
      {
        proofRecipes: [
          {
            id: 'billing-retry-safety',
            matches: ['src/billing/**'],
            requiredCommands: ['npm run test:billing', 'npm run typecheck'],
            requiredReviewers: ['@billing-platform'],
            forbiddenFiles: ['src/billing/paymentGateway.ts'],
            reason: 'Billing retry changes need focused regression proof and platform review.',
          },
        ],
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
    "test('caps retry delay', () => undefined);\n",
  );
  await git(['init']);
  await git(['config', 'user.email', 'projscan@example.test']);
  await git(['config', 'user.name', 'Projscan Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'initial billing retry']);
  linkedWorktreePath = path.join(os.tmpdir(), `projscan-cli-review-gate-linked-${Date.now()}`);
  await git(['worktree', 'add', '-q', '-b', 'agent-b', linkedWorktreePath]);
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
  await fs.writeFile(
    path.join(linkedWorktreePath, 'src/billing/retryPolicy.ts'),
    [
      'export function nextRetryDelay(attempt: number): number {',
      '  const exponential = 2 ** Math.max(attempt - 1, 0) * 500;',
      '  return Math.min(exponential, 9000);',
      '}',
      '',
    ].join('\n'),
  );
});

afterEach(async () => {
  if (linkedWorktreePath) {
    await execFileAsync('git', ['worktree', 'remove', '--force', linkedWorktreePath], { cwd: tmp }).catch(
      () => undefined,
    );
    await fs.rm(linkedWorktreePath, { recursive: true, force: true });
  }
  await fs.rm(tmp, { recursive: true, force: true });
});

test('review-gate renders JSON, PR-comment markdown, and console handoff output', async () => {
  const json = await runCli([
    'review-gate',
    '--intent',
    'is my agent allowed to change billing retry logic?',
    '--save-contract',
    '.projscan/proof-contract.json',
    '--output-passport',
    '.projscan/passport.json',
    '--output',
    '.projscan/review-gate.json',
    '--base-ref',
    'HEAD',
    '--ledger',
    '.projscan/proof-ledger.jsonl',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  const report = JSON.parse(json.stdout);
  expect(report.kind).toBe('review-gate');
  expect(report.status).toBe('needs-proof');
  expect(report.decision.allowReview).toBe(false);
  expect(report.proofDebt.total).toBeGreaterThan(0);
  expect(report.requiredReviewers).toContain('@billing-platform');
  expect(report.artifacts.passportPath).toBe('.projscan/passport.json');
  expect(report.artifacts.reviewGatePath).toBe('.projscan/review-gate.json');
  const saved = JSON.parse(await fs.readFile(path.join(tmp, '.projscan/review-gate.json'), 'utf-8'));
  expect(saved.kind).toBe('review-gate');

  const markdown = await runCli([
    'review-gate',
    '--contract',
    '.projscan/proof-contract.json',
    '--pr-comment',
    '--base-ref',
    'HEAD',
    '--ledger',
    '.projscan/proof-ledger.jsonl',
    '--quiet',
  ]);
  expect(markdown.exitCode).toBe(0);
  expect(markdown.stdout).toContain('## Projscan Review Gate');
  expect(markdown.stdout).toContain('Proof debt');
  expect(markdown.stdout).toContain('npm run test:billing');
  expect(markdown.stdout).toContain('@billing-platform');

  const consoleResult = await runCli([
    'review-gate',
    '--contract',
    '.projscan/proof-contract.json',
    '--quiet',
  ]);
  expect(consoleResult.exitCode).toBe(0);
  expect(consoleResult.stdout).toContain('Projscan Review Gate');
  expect(consoleResult.stdout).toContain('Proof Debt');
  expect(consoleResult.stdout).toContain('Next Commands');
});

test('review-gate ci mode fails while proof debt remains', async () => {
  const result = await runCli([
    'review-gate',
    '--intent',
    'is my agent allowed to change billing retry logic?',
    '--save-contract',
    '.projscan/proof-contract.json',
    '--ci',
    '--fail-on-needs-proof',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain('Projscan Review Gate: needs-proof');
  expect(result.stdout).toContain('allow review: no');
  expect(result.stdout).toContain('proof debt:');
});

test('review-gate targets the linked worktree when run from linked cwd', async () => {
  const result = await runCli(
    [
      'review-gate',
      '--intent',
      'is my agent allowed to change billing retry logic from a linked worktree?',
      '--save-contract',
      '.projscan/proof-contract.json',
      '--format',
      'json',
      '--quiet',
    ],
    linkedWorktreePath,
  );

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.target.effectiveWorktreePath).toBe(canonicalPath(linkedWorktreePath));
  expect(report.target.effectiveWorktreeBranch).toBe('agent-b');
  expect(report.target.gitCommonRoot).toBe(canonicalPath(tmp));

  const consoleResult = await runCli(
    ['review-gate', '--contract', '.projscan/proof-contract.json', '--quiet'],
    linkedWorktreePath,
  );
  expect(consoleResult.exitCode).toBe(0);
  expect(consoleResult.stdout).toContain('Target');
  expect(consoleResult.stdout).toContain(canonicalPath(linkedWorktreePath));
  expect(consoleResult.stdout).toContain('agent-b');
});

test('review-gate honors --worktree override from the shared root', async () => {
  const result = await runCli([
    'review-gate',
    '--intent',
    'is my agent allowed to change billing retry logic from the shared root?',
    '--save-contract',
    '.projscan/proof-contract.json',
    '--worktree',
    linkedWorktreePath,
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.target.effectiveWorktreePath).toBe(canonicalPath(linkedWorktreePath));
  expect(report.target.effectiveWorktreeBranch).toBe('agent-b');
  expect(report.target.gitCommonRoot).toBe(canonicalPath(tmp));
});

test('review-gate fails cleanly for a non-worktree override path', async () => {
  const invalidPath = path.join(os.tmpdir(), `projscan-cli-review-gate-invalid-${Date.now()}`);
  await fs.mkdir(invalidPath, { recursive: true });

  try {
    const result = await runCli([
      'review-gate',
      '--contract',
      '.projscan/proof-contract.json',
      '--worktree',
      invalidPath,
      '--quiet',
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('is not inside a git worktree');
  } finally {
    await fs.rm(invalidPath, { recursive: true, force: true });
  }
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function runCli(
  args: string[],
  cwd = tmp,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd, maxBuffer: 4 * 1024 * 1024 });
}
