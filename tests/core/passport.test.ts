import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { computePassport } from '../../src/core/passport.js';

const execFileAsync = promisify(execFile);
const PASSPORT_INTEGRATION_TEST_TIMEOUT_MS = 120_000;

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-passport-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        type: 'module',
        scripts: { test: 'vitest run', typecheck: 'tsc --noEmit' },
        devDependencies: { vitest: '^3.0.0', typescript: '^5.0.0' },
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/core'), { recursive: true });
  await fs.mkdir(path.join(tmp, 'tests/core'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(tmp, 'tests/core/bugHunt.test.ts'),
    [
      "import { buildBugHuntReport } from '../../src/core/bugHunt.js';",
      '',
      "test('builds report', () => {",
      "  expect(buildBugHuntReport(['a'])).toEqual(['A']);",
      '});',
      '',
    ].join('\n'),
  );
  await git(['init']);
  await git(['config', 'user.email', 'projscan@example.test']);
  await git(['config', 'user.name', 'Projscan Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'initial']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('builds an agent change passport from an intent and current receipt', async () => {
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  const passport = await computePassport(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    saveContractPath: '.projscan/proof-contract.json',
  });

  expect(passport.schemaVersion).toBe(1);
  expect(passport.kind).toBe('agent-change-passport');
  expect(passport.intent).toBe('split bugHunt.ts into ranking, evidence, and output modules');
  expect(passport.boundary.contractId).toContain('proof-contract');
  expect(passport.boundary.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(passport.boundary.forbiddenFiles).toContain('package.json');
  expect(passport.receipt.scopeStatus).toBe('within-contract');
  expect(passport.receipt.changedFiles).toContain('src/core/bugHunt.ts');
  expect(passport.receipt.proofStatus).toMatch(/missing|not-run/);
  expect(passport.receipt.proofSufficiencyStatus).toMatch(/missing|weak/);
  expect(passport.reviewer.action).toBe('run-proof');
  expect(passport.reviewer.decision).toBe('needs-focused-review');
  expect(passport.nextCommands).toContain(
    'projscan prove --changed --contract .projscan/proof-contract.json --format markdown',
  );
  expect(passport.prove.verifiedWorkflow.missingProof).toBe(true);
  expect(passport.artifacts.contractPath).toBe('.projscan/proof-contract.json');
}, PASSPORT_INTEGRATION_TEST_TIMEOUT_MS);

test('writes only passport artifacts under allowed projscan paths', async () => {
  const passport = await computePassport(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    outputPath: '.projscan/passport.json',
  });

  const saved = JSON.parse(await fs.readFile(path.join(tmp, '.projscan/passport.json'), 'utf-8'));
  expect(saved.kind).toBe('agent-change-passport');
  expect(saved.boundary.contractId).toBe(passport.boundary.contractId);
  expect(passport.artifacts.passportPath).toBe('.projscan/passport.json');

  await fs.writeFile(path.join(tmp, '.projscan/passport.json'), '{"kind":"other"}\n');
  await expect(
    computePassport(tmp, {
      intent: 'split bugHunt.ts into ranking, evidence, and output modules',
      outputPath: '.projscan/passport.json',
    }),
  ).rejects.toThrow(/Refusing to overwrite/);

  await expect(
    computePassport(tmp, {
      intent: 'split bugHunt.ts into ranking, evidence, and output modules',
      outputPath: '../passport.json',
    }),
  ).rejects.toThrow(/must stay inside/);
}, PASSPORT_INTEGRATION_TEST_TIMEOUT_MS);

test('can attach a Baseframe assessment artifact to the passport', async () => {
  const passport = await computePassport(tmp, {
    intent: 'Implement password reset',
    taskId: 'auth-password-reset-20260627-01',
    emitBaseframe: true,
  });

  expect(passport.baseframe?.taskId).toBe('auth-password-reset-20260627-01');
  expect(passport.baseframe?.assessmentPath).toBe(
    '.baseframe/evidence/auth-password-reset-20260627-01/projscan-assessment.json',
  );
  expect(passport.baseframe?.workflowPath).toBe('.baseframe/agent-workflow.json');
  await expect(
    fs.access(
      path.join(
        tmp,
        '.baseframe/evidence/auth-password-reset-20260627-01/projscan-assessment.json',
      ),
    ),
  ).resolves.toBeUndefined();
}, PASSPORT_INTEGRATION_TEST_TIMEOUT_MS);

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
