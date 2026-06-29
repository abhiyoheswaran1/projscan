import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { computeProve } from '../../src/core/prove.js';

const execFileAsync = promisify(execFile);
const PROOF_REPLAY_TEST_TIMEOUT_MS = 120_000;

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-prove-'));
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

test('builds an executable contract from an intent', async () => {
  const report = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });

  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('intent');
  expect(report.verdict).toBe('ready');
  expect(report.contract?.intent).toBe(
    'split bugHunt.ts into ranking, evidence, and output modules',
  );
  expect(report.contract?.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(report.contract?.forbiddenFiles).toContain('package.json');
  expect(report.contract?.likelyTests).toContain('tests/core/bugHunt.test.ts');
  expect(report.contract?.riskyContracts).toContain('module boundary');
  expect(report.contract?.proofCommands).toContain(
    'projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json',
  );
  expect(report.contract?.proofRequirements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        surface: 'production',
        files: expect.arrayContaining(['src/core/bugHunt.ts']),
        requiredCommands: expect.arrayContaining(['npm test -- tests/core/bugHunt.test.ts']),
        requiredReview: 'review changed production behavior and matching regression proof',
      }),
      expect.objectContaining({
        surface: 'test',
        files: expect.arrayContaining(['tests/core/bugHunt.test.ts']),
        requiredCommands: expect.arrayContaining(['npm test -- tests/core/bugHunt.test.ts']),
      }),
    ]),
  );
  expect(report.contract?.safeChangeShape).toContain('bounded');
  expect(report.contract?.rollbackPlan).toContain('git restore');
  expect(report.contract?.receiptCommand).toContain('projscan prove --changed');
  expect(report.contract?.reviewerGuidance).toContain('Review scope first');
  expect((report as any).verifiedWorkflow).toEqual(
    expect.objectContaining({
      phase: 'contract',
      status: 'ready',
      nextAction: 'save the Proof Contract, make the bounded edit, then record proof commands',
      nextCommand: report.contract?.receiptCommand,
      staleProof: false,
      missingProof: true,
      failedProof: false,
    }),
  );
  expect((report.contract as any).verifiedWorkflow).toEqual((report as any).verifiedWorkflow);
  expect(report.receipt).toBeUndefined();
});

test('intent contracts do not whitelist unrelated dirty worktree files', async () => {
  await fs.mkdir(path.join(tmp, 'src/generated'), { recursive: true });
  for (let i = 0; i < 55; i += 1) {
    await fs.writeFile(
      path.join(tmp, 'src/generated', `changed-${i}.ts`),
      `export const unrelated${i} = ${i};\n`,
    );
  }

  const report = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });

  expect(report.contract?.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(report.contract?.allowedFiles.some((file) => file.startsWith('src/generated/'))).toBe(
    false,
  );
});

test('validates changed files against a saved contract', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.mode).toBe('changed');
  expect(report.contract?.id).toBe(contractReport.contract?.id);
  expect(report.receipt?.scope.status).toBe('within-contract');
  expect(report.receipt?.scope.changedFiles).toContain('src/core/bugHunt.ts');
  expect(report.receipt?.scope.forbiddenTouched).toEqual([]);
  expect(report.receipt?.commitReadiness).toMatch(/ready|needs-review/);
  expect(report.receipt?.proofStatus.commandsRequired).toContain(
    'projscan assess --mode fix-first --format json',
  );
  expect((report as any).verifiedWorkflow).toEqual(
    expect.objectContaining({
      phase: 'receipt',
      status: report.verdict,
      scopeStatus: 'within-contract',
      proofStatus: 'missing',
      reviewerDecision: report.receipt?.reviewerDecision,
      nextCommand: 'projscan prove --record-command "<command>" --exit-code 0 --duration-ms <ms>',
      staleProof: false,
      missingProof: true,
      failedProof: false,
    }),
  );
  expect((report.receipt as any).verifiedWorkflow).toEqual((report as any).verifiedWorkflow);
});

test('does not mark changed source ready when a contract requires no proof commands', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  const noProofContract = {
    ...contractReport.contract!,
    proofCommands: [],
    proofRequirements: [],
    evidenceStrength: {
      ...contractReport.contract!.evidenceStrength,
      gaps: [],
    },
  };

  const report = await computeProve(tmp, {
    changed: true,
    contract: noProofContract,
  });

  expect(report.receipt?.scope.status).toBe('within-contract');
  expect(report.receipt?.scope.allowedTouched).toContain('src/core/bugHunt.ts');
  expect(report.receipt?.proofStatus.status).toBe('not-run');
  expect(report.receipt?.commitReadiness).not.toBe('ready');
  expect(report.receipt?.reviewerDecision).toBe('needs-focused-review');
  expect(report.verifiedWorkflow).toEqual(
    expect.objectContaining({
      status: report.receipt?.commitReadiness,
      proofStatus: 'not-run',
      missingProof: true,
    }),
  );
});

test('team proof recipes enrich intent contracts with commands, reviewers, and forbidden drift', async () => {
  const report = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    proofRecipes: [
      {
        id: 'core-critical',
        matches: ['src/**/*.ts'],
        requiredCommands: ['npm test -- tests/core/bugHunt.test.ts -- --runInBand'],
        requiredReviewers: ['@platform'],
        forbiddenFiles: ['src/auth/**'],
        riskSurface: 'core',
        reason: 'Core changes need platform proof.',
      },
    ],
  } as never);

  expect(report.contract?.proofCommands).toContain(
    'npm test -- tests/core/bugHunt.test.ts -- --runInBand',
  );
  expect(report.contract?.forbiddenFiles).toContain('src/auth/**');
  expect(report.contract?.teamProofRecipes).toEqual([
    {
      id: 'core-critical',
      matches: ['src/**/*.ts'],
      matchedFiles: ['src/core/bugHunt.ts'],
      requiredCommands: ['npm test -- tests/core/bugHunt.test.ts -- --runInBand'],
      requiredReviewers: ['@platform'],
      forbiddenFiles: ['src/auth/**'],
      riskSurface: 'core',
      reason: 'Core changes need platform proof.',
    },
  ]);
  expect(report.contract?.proofRequirements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'recipe',
        recipeId: 'core-critical',
        surface: 'custom',
        requiredCommands: ['npm test -- tests/core/bugHunt.test.ts -- --runInBand'],
        requiredReviewers: ['@platform'],
      }),
    ]),
  );
});

test('nonmatching team proof recipes do not change intent contracts', async () => {
  const report = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    proofRecipes: [
      {
        id: 'docs-only',
        matches: ['docs/**'],
        requiredCommands: ['npm test -- docs-only'],
        requiredReviewers: ['@docs'],
        forbiddenFiles: ['src/auth/**'],
      },
    ],
  });

  expect(report.contract?.proofCommands).not.toContain('npm test -- docs-only');
  expect(report.contract?.forbiddenFiles).not.toContain('src/auth/**');
  expect(report.contract?.teamProofRecipes).toBeUndefined();
  expect(report.contract?.proofRequirements).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ recipeId: 'docs-only' })]),
  );
});

test('proof contracts cannot be written outside the project root', async () => {
  await expect(
    computeProve(tmp, {
      intent: 'split bugHunt.ts into ranking, evidence, and output modules',
      saveContractPath: '../proof-contract.json',
    }),
  ).rejects.toThrow('inside the project root');

  await expect(
    computeProve(tmp, {
      intent: 'split bugHunt.ts into ranking, evidence, and output modules',
      saveContractPath: 'proof-contract.json',
    }),
  ).rejects.toThrow('Proof Contract path must be .projscan/proof-contract.json');
});

test('classifies changed files so proof receipts are reviewable', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.mkdir(path.join(tmp, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
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
      "  expect(buildBugHuntReport([' a '])).toEqual(['A']);",
      '});',
      '',
    ].join('\n'),
  );
  await fs.writeFile(path.join(tmp, 'docs', 'proof-contracts.md'), '# Proof Contracts\n');
  await fs.writeFile(path.join(tmp, 'src/core/unplanned.ts'), 'export const drift = true;\n');
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.scope.classifications).toEqual(
    expect.arrayContaining([
      {
        file: 'src/core/bugHunt.ts',
        kind: 'allowed-production',
        reason: 'Allowed by the Proof Contract.',
      },
      {
        file: 'tests/core/bugHunt.test.ts',
        kind: 'expected-test',
        reason: 'Expected regression test from the Proof Contract.',
      },
      {
        file: 'docs/proof-contracts.md',
        kind: 'documentation',
        reason: 'Documentation change outside contract scope.',
      },
      {
        file: 'src/core/unplanned.ts',
        kind: 'unexpected-production',
        reason: 'Production source changed outside the Proof Contract.',
      },
      {
        file: 'package.json',
        kind: 'forbidden',
        reason: 'Matched forbidden Proof Contract scope.',
      },
    ]),
  );
  expect(report.receipt?.scope.unexpectedProduction).toContain('src/core/unplanned.ts');
  expect(report.receipt?.scope.documentationTouched).toContain('docs/proof-contracts.md');
  expect(report.receipt?.scope.configTouched).toContain('package.json');
  expect(report.receipt?.commitReadiness).toBe('blocked');
});

test('applies noisy trust memory to contract confidence evidence', async () => {
  const feedbackPath = path.join(tmp, '.projscan-feedback.json');
  await fs.writeFile(
    feedbackPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        responses: [
          {
            repo: 'fixture',
            pr: '42',
            useful: false,
            missingSignals: ['coverage signal'],
            noisyFindings: ['overbroad proof scope'],
            falsePositiveRules: ['unused-exports'],
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const report = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    feedbackPath,
  });

  expect(report.contract?.trustMemory.status).toBe('needs-tuning');
  expect(report.contract?.trustMemory.signals).toEqual(
    expect.arrayContaining([
      'not useful: fixture PR 42',
      'missing signal: coverage signal',
      'noisy finding: overbroad proof scope',
      'false positive: unused-exports',
    ]),
  );
  expect(report.contract?.confidenceReason).toContain('Trust Memory lowered confidence');
  expect(report.contract?.evidenceStrength.gaps).toContain(
    'Trust Memory reports missing signals or noisy findings for similar proof workflows.',
  );
});

test('records proof command outcomes in a local redacted ledger', async () => {
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, {
    recordCommand:
      'OPENAI_API_KEY=sk-proj-secret123 npm test -- tests/core/bugHunt.test.ts -- --token ghp_secret123456',
    exitCode: 0,
    durationMs: 4210,
    summary: 'passed with Bearer sk_test_123456789 and password=secret-value',
    logPath: '.projscan/proof-logs/bugHunt-test.log',
  } as never);
  const ledgerRaw = await fs.readFile(path.join(tmp, '.projscan/proof-ledger.jsonl'), 'utf-8');
  const [row] = ledgerRaw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  expect(report.mode).toBe('record');
  expect(report.ledgerRecord?.command).toContain('[redacted]');
  expect(report.ledgerRecord?.command).not.toContain('sk-proj-secret123');
  expect(report.ledgerRecord?.command).not.toContain('ghp_secret123456');
  expect(report.ledgerRecord?.source).toBe('prove-record');
  expect(report.ledgerRecord?.status).toBe('passed');
  expect((report as any).verifiedWorkflow).toEqual(
    expect.objectContaining({
      phase: 'record',
      status: 'ready',
      nextAction: 'run projscan prove --changed to replay the ledger against the current diff',
      nextCommand: 'projscan prove --changed --format markdown',
      staleProof: false,
      missingProof: false,
      failedProof: false,
    }),
  );
  expect(row.command).toBe(report.ledgerRecord?.command);
  expect(row.command).toContain('[redacted]');
  expect(row.command).not.toContain('sk-proj-secret123');
  expect(row.command).not.toContain('ghp_secret123456');
  expect(row.normalizedCommand).not.toContain('sk-proj-secret123');
  expect(row.source).toBe('prove-record');
  expect(row.exitCode).toBe(0);
  expect(row.durationMs).toBe(4210);
  expect(row.changedFiles).toContain('src/core/bugHunt.ts');
  expect(row.outputSummary).toContain('[redacted]');
  expect(row.outputSummary).not.toContain('sk_test_123456789');
  expect(row.outputSummary).not.toContain('secret-value');
  expect(row.logPath).toBe('.projscan/proof-logs/bugHunt-test.log');
});

test('proof ledger evidence becomes stale after same-file content changes', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  await recordProofCommands(contractReport.contract?.proofCommands ?? [], 0, 'prove-run');
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toLowerCase());',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofStatus.status).toBe('stale');
  expect(report.receipt?.proofStatus.commandEvidence[0]).toEqual(
    expect.objectContaining({
      status: 'stale',
      fresh: false,
      source: 'prove-run',
      staleReason: expect.stringContaining('changed-file content'),
    }),
  );
  expect(report.receipt?.proofReplay.status).toBe('stale');
}, PROOF_REPLAY_TEST_TIMEOUT_MS);

test('runs a proof command and records executed ledger evidence', async () => {
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, {
    runCommand: [
      process.execPath,
      '-e',
      'console.log("token=secret-value"); console.error("ok"); process.exit(0);',
    ],
  } as never);
  const ledgerRaw = await fs.readFile(path.join(tmp, '.projscan/proof-ledger.jsonl'), 'utf-8');
  const [row] = ledgerRaw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  expect(report.mode).toBe('run');
  expect(report.verdict).toBe('ready');
  expect(report.ledgerRecord?.source).toBe('prove-run');
  expect(report.ledgerRecord?.status).toBe('passed');
  expect(report.ledgerRecord?.exitCode).toBe(0);
  expect(report.ledgerRecord?.durationMs).toBeGreaterThanOrEqual(0);
  expect(report.ledgerRecord?.changedFiles).toContain('src/core/bugHunt.ts');
  expect(report.ledgerRecord?.outputSummary).toContain('[redacted]');
  expect(report.ledgerRecord?.outputSummary).not.toContain('secret-value');
  expect(report.ledgerRecord?.logPath).toMatch(/^\.projscan\/proof-logs\//);
  expect(row.source).toBe('prove-run');
  expect(row.logPath).toBe(report.ledgerRecord?.logPath);
  const log = await fs.readFile(path.join(tmp, row.logPath), 'utf-8');
  expect(log).toContain('[redacted]');
  expect(log).not.toContain('secret-value');
});

test('redacts standalone secrets from executed proof logs', async () => {
  const privateKeyLabel = ['PRIVATE', 'KEY'].join(' ');
  const pem = [
    `-----BEGIN ${privateKeyLabel}-----`,
    'synthetic-proof-fixture-value',
    `-----END ${privateKeyLabel}-----`,
  ].join('\n');
  const jwt = [
    ['eyJ', 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'].join(''),
    ['eyJ', 'zdWIiOiJwcm9qc2Nhbi10ZXN0In0'].join(''),
    ['signature', 'fixture', 'only'].join(''),
  ].join('.');
  const slack = ['xoxb', '111111111111', '222222222222', 'syntheticfixturetoken'].join('-');
  const script = `const values = ${JSON.stringify([pem, jwt, slack])}; console.log(values.join("\\n"));`;

  const report = await computeProve(tmp, {
    runCommand: [process.execPath, '-e', script],
  } as never);
  const logPath = report.ledgerRecord?.logPath;
  expect(logPath).toBeTruthy();
  const log = await fs.readFile(path.join(tmp, logPath ?? ''), 'utf-8');

  for (const secret of [pem, jwt, slack]) {
    expect(report.ledgerRecord?.command).not.toContain(secret);
    expect(report.ledgerRecord?.outputSummary).not.toContain(secret);
    expect(log).not.toContain(secret);
  }
  expect(log).toContain('[redacted]');
});

test('failed executed proof records a blocking ledger row', async () => {
  const report = await computeProve(tmp, {
    runCommand: [process.execPath, '-e', 'console.error("test failed"); process.exit(7);'],
  } as never);

  expect(report.mode).toBe('run');
  expect(report.verdict).toBe('blocked');
  expect(report.ledgerRecord?.source).toBe('prove-run');
  expect(report.ledgerRecord?.status).toBe('failed');
  expect(report.ledgerRecord?.exitCode).toBe(7);
  expect((report as any).verifiedWorkflow).toEqual(
    expect.objectContaining({
      phase: 'record',
      status: 'blocked',
      staleProof: false,
      missingProof: false,
      failedProof: true,
    }),
  );
});

test('replays executed proof ledger evidence in changed receipts', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  const runReport = await computeProve(tmp, {
    runCommand: [process.execPath, '-e', 'console.log("passed");'],
  } as never);
  const command = runReport.ledgerRecord?.command;
  expect(command).toBeTruthy();

  const report = await computeProve(tmp, {
    changed: true,
    contract: {
      ...contractReport.contract!,
      proofCommands: [command ?? ''],
    },
  });

  expect(report.receipt?.proofStatus.status).toBe('passed');
  expect(report.receipt?.proofStatus.commandsRun).toEqual([command]);
  expect(report.receipt?.proofStatus.commandEvidence[0]).toEqual(
    expect.objectContaining({
      command,
      status: 'passed',
      fresh: true,
      source: 'prove-run',
      outputSummary: expect.any(String),
      logPath: expect.stringMatching(/^\.projscan\/proof-logs\//),
    }),
  );
});

test('rejects proof ledger paths outside the project root', async () => {
  await expect(
    computeProve(tmp, {
      recordCommand: 'npm test -- tests/core/bugHunt.test.ts',
      exitCode: 0,
      durationMs: 42,
      ledgerPath: '../proof-ledger.jsonl',
    } as never),
  ).rejects.toThrow('Proof ledger path must stay inside the project root');

  await expect(
    computeProve(tmp, {
      changed: true,
      ledgerPath: path.join(os.tmpdir(), 'projscan-ledger.jsonl'),
    } as never),
  ).rejects.toThrow('Proof ledger path must stay inside the project root');

  await expect(
    computeProve(tmp, {
      recordCommand: 'npm test -- tests/core/bugHunt.test.ts',
      exitCode: 0,
      durationMs: 42,
      ledgerPath: 'proof-ledger.jsonl',
    } as never),
  ).rejects.toThrow('Proof ledger path must be .projscan/proof-ledger.jsonl');
});

test('rejects proof log metadata paths outside proof logs', async () => {
  await expect(
    computeProve(tmp, {
      recordCommand: 'npm test -- tests/core/bugHunt.test.ts',
      exitCode: 0,
      durationMs: 42,
      logPath: '.projscan/other.log',
    } as never),
  ).rejects.toThrow('Proof log path must stay under .projscan/proof-logs/');
});

test('rejects proof ledger writes when .projscan is a symlink', async () => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-outside-'));
  await fs.symlink(outside, path.join(tmp, '.projscan'), 'dir');

  try {
    await expect(
      computeProve(tmp, {
        recordCommand: 'npm test -- tests/core/bugHunt.test.ts',
        exitCode: 0,
        durationMs: 42,
      } as never),
    ).rejects.toThrow('Proof artifact paths must not contain symlinks');
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  } finally {
    await fs.rm(path.join(tmp, '.projscan'), { force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('rejects executed proof logs when .projscan is a symlink', async () => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-outside-'));
  await fs.symlink(outside, path.join(tmp, '.projscan'), 'dir');

  try {
    await expect(
      computeProve(tmp, {
        runCommand: [process.execPath, '-e', 'console.log("proof")'],
      } as never),
    ).rejects.toThrow('Proof artifact paths must not contain symlinks');
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  } finally {
    await fs.rm(path.join(tmp, '.projscan'), { force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('rejects saved Proof Contracts when .projscan is a symlink', async () => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-outside-'));
  await fs.symlink(outside, path.join(tmp, '.projscan'), 'dir');

  try {
    await expect(
      computeProve(tmp, {
        intent: 'split bugHunt.ts into ranking, evidence, and output modules',
        saveContractPath: '.projscan/proof-contract.json',
      }),
    ).rejects.toThrow('Proof artifact paths must not contain symlinks');
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  } finally {
    await fs.rm(path.join(tmp, '.projscan'), { force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('rejects symlinked Proof Contract reads', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-proof-outside-'));
  const outsideContract = path.join(outside, 'proof-contract.json');
  await fs.mkdir(path.join(tmp, '.projscan'), { recursive: true });
  await fs.writeFile(outsideContract, `${JSON.stringify(contractReport.contract, null, 2)}\n`);
  await fs.symlink(outsideContract, path.join(tmp, '.projscan', 'proof-contract.json'));
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  try {
    await expect(computeProve(tmp, { changed: true })).rejects.toThrow(
      'Proof artifact paths must not contain symlinks',
    );
  } finally {
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('replays fresh proof ledger evidence in changed receipts', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  await recordProofCommands(contractReport.contract?.proofCommands ?? [], 0, 'prove-run');

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofStatus.status).toBe('passed');
  expect(report.receipt?.proofStatus.missingCommands).toEqual([]);
  expect(report.receipt?.proofStatus.failedCommands).toEqual([]);
  expect(report.receipt?.proofStatus.staleCommands).toEqual([]);
  expect(report.receipt?.proofStatus.commandEvidence).toHaveLength(
    contractReport.contract?.proofCommands.length,
  );
  expect(report.receipt?.proofStatus.commandEvidence.every((entry) => entry.fresh)).toBe(true);
  expect(report.receipt?.reviewerDecision).toMatch(/safe-to-review|needs-focused-review/);
  expect(report.receipt?.riskDeltaDirection).toMatch(/improved|flat|worse/);
  expect(report.receipt?.proofReplay).toEqual(
    expect.objectContaining({
      status: 'verified',
      changedAfterProof: [],
      replayCommand: 'projscan prove --changed --format markdown',
      receiptFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
    }),
  );
  expect(report.receipt?.proofReplay.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'proof-command',
        status: 'passed',
        command: 'npm test -- tests/core/bugHunt.test.ts',
      }),
      expect.objectContaining({
        kind: 'receipt',
        status: 'verified',
      }),
    ]),
  );
}, PROOF_REPLAY_TEST_TIMEOUT_MS);

test('proof sufficiency is strong when executed proof covers the changed surface', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
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
      "  expect(buildBugHuntReport([' a '])).toEqual(['A']);",
      '});',
      '',
    ].join('\n'),
  );
  await recordProofCommands(contractReport.contract?.proofCommands ?? [], 0, 'prove-run');

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofSufficiency.status).toBe('strong');
  expect(report.receipt?.proofSufficiency.gaps).toEqual([]);
  expect(report.receipt?.proofSufficiency.requirements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        surface: 'production',
        status: 'strong',
        matchedCommands: expect.arrayContaining(['npm test -- tests/core/bugHunt.test.ts']),
      }),
      expect.objectContaining({
        surface: 'test',
        status: 'strong',
      }),
    ]),
  );
  expect((report as any).verifiedWorkflow).toEqual(
    expect.objectContaining({
      proofSufficiencyStatus: 'strong',
    }),
  );
}, PROOF_REPLAY_TEST_TIMEOUT_MS);

test('recorded-only proof stays weak until execution provenance is available', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  await recordProofCommands(contractReport.contract?.proofCommands ?? [], 0);

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofStatus.status).toBe('passed');
  expect(report.receipt?.proofSufficiency.status).toBe('weak');
  expect(report.receipt?.reviewerDecision).toBe('needs-focused-review');
  expect(report.receipt?.reviewerGuidance).toContain('weak proof');
});

test('proof sufficiency is missing when no required proof was recorded', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofSufficiency.status).toBe('missing');
  expect(report.receipt?.proofSufficiency.missingRequirements).toEqual(
    expect.arrayContaining([expect.stringContaining('production')]),
  );
  expect(report.receipt?.proofSufficiency.gaps.join('\n')).toContain('missing proof');
  expect(report.receipt?.proofReplay.status).toBe('needs-proof');
  expect(report.receipt?.proofReplay.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'proof-command',
        status: 'missing',
      }),
    ]),
  );
  expect(report.verdict).toBe('needs-review');
});

test('team proof recipes require configured proof and reviewers in changed receipts', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    proofRecipes: [
      {
        id: 'core-critical',
        matches: ['src/core/**'],
        requiredCommands: ['npm test -- tests/core/bugHunt.test.ts -- --runInBand'],
        requiredReviewers: ['@platform'],
        forbiddenFiles: ['src/auth/**'],
        riskSurface: 'core',
        reason: 'Core changes need platform proof.',
      },
    ],
  } as never);
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.teamProofRecipes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'core-critical',
        matchedFiles: ['src/core/bugHunt.ts'],
        requiredReviewers: ['@platform'],
        missingCommands: ['npm test -- tests/core/bugHunt.test.ts -- --runInBand'],
      }),
    ]),
  );
  expect(report.receipt?.requiredReviewers).toEqual(['@platform']);
  expect(report.receipt?.recipeGaps).toContain(
    'core-critical requires proof command: npm test -- tests/core/bugHunt.test.ts -- --runInBand',
  );
  expect(report.receipt?.proofStatus.missingCommands).toContain(
    'npm test -- tests/core/bugHunt.test.ts -- --runInBand',
  );
  expect(report.receipt?.proofSufficiency.missingRequirements).toEqual(
    expect.arrayContaining([expect.stringContaining('recipe:core-critical')]),
  );
});

test('team proof recipes keep attribution when only forbidden files drift', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    proofRecipes: [
      {
        id: 'core-critical',
        matches: ['src/core/**'],
        requiredCommands: ['npm test -- tests/core/bugHunt.test.ts -- --runInBand'],
        requiredReviewers: ['@platform'],
        forbiddenFiles: ['src/auth/**'],
      },
    ],
  });
  await fs.mkdir(path.join(tmp, 'src/auth'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src/auth/session.ts'), 'export const session = true;\n');

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.scope.forbiddenTouched).toContain('src/auth/session.ts');
  expect(report.receipt?.teamProofRecipes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'core-critical',
        matchedFiles: [],
        forbiddenTouched: ['src/auth/session.ts'],
        requiredReviewers: ['@platform'],
      }),
    ]),
  );
  expect(report.receipt?.requiredReviewers).toEqual(['@platform']);
  expect(report.receipt?.recipeDrift).toEqual(['src/auth/session.ts']);
});

test('failed proof ledger evidence stops reviewer approval', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings;',
      '}',
      '',
    ].join('\n'),
  );
  const commands = contractReport.contract?.proofCommands ?? [];
  await recordProofCommands(commands, 0);
  await computeProve(tmp, {
    recordCommand: commands[0],
    exitCode: 1,
    durationMs: 91,
    summary: 'test failed',
    logPath: '.projscan/proof-logs/failed.log',
  } as never);

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofStatus.status).toBe('failed');
  expect(report.receipt?.proofSufficiency.status).toBe('failed');
  expect(report.receipt?.proofSufficiency.failedRequirements).toEqual(
    expect.arrayContaining([expect.stringContaining('production')]),
  );
  expect(report.receipt?.proofStatus.failedCommands).toContain(commands[0]);
  expect(report.receipt?.reviewerDecision).toBe('stop');
  expect(report.receipt?.commitReadiness).toBe('blocked');
}, PROOF_REPLAY_TEST_TIMEOUT_MS);

test('proof ledger evidence becomes stale after changed files move', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings.map((finding) => finding.trim().toUpperCase());',
      '}',
      '',
    ].join('\n'),
  );
  await recordProofCommands(contractReport.contract?.proofCommands ?? [], 0);
  await fs.writeFile(path.join(tmp, 'src/core/newRisk.ts'), 'export const newRisk = true;\n');

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.proofStatus.status).toBe('stale');
  expect(report.receipt?.proofSufficiency.status).toBe('stale');
  expect(report.receipt?.proofSufficiency.staleRequirements).toEqual(
    expect.arrayContaining([expect.stringContaining('production')]),
  );
  expect((report as any).verifiedWorkflow).toEqual(
    expect.objectContaining({
      phase: 'receipt',
      proofStatus: 'stale',
      proofSufficiencyStatus: 'stale',
      staleProof: true,
      missingProof: false,
      failedProof: false,
      nextAction: 'rerun stale proof commands before review',
    }),
  );
  expect(report.receipt?.proofStatus.staleCommands).toEqual(
    contractReport.contract?.proofCommands,
  );
  expect(report.receipt?.proofReplay.status).toBe('stale');
  expect(report.receipt?.proofReplay.changedAfterProof).toContain('src/core/newRisk.ts');
  expect(report.receipt?.proofReplay.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'proof-command',
        status: 'stale',
        changedAfterProof: expect.arrayContaining(['src/core/newRisk.ts']),
      }),
    ]),
  );
  expect(report.receipt?.proofStatus.commandEvidence[0]?.staleReason).toContain(
    'changed files differ',
  );
  expect(report.receipt?.reviewerDecision).toBe('needs-focused-review');
});

test('flags forbidden scope drift', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');

  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });

  expect(report.receipt?.scope.status).toBe('drifted');
  expect(report.receipt?.scope.forbiddenTouched).toContain('package.json');
  expect(report.receipt?.commitReadiness).toBe('blocked');
  expect(report.summary).toContain('forbidden');
});

test('changed mode without a contract stays honest about missing evidence', async () => {
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    [
      'export function buildBugHuntReport(findings: string[]): string[] {',
      '  return findings;',
      '}',
      '',
    ].join('\n'),
  );

  const report = await computeProve(tmp, { changed: true });

  expect(report.mode).toBe('changed');
  expect(report.verdict).toBe('needs-review');
  expect(report.contract).toBeUndefined();
  expect(report.receipt?.scope.status).toBe('missing-contract');
  expect(report.receipt?.proofSufficiency.status).toBe('missing');
  expect(report.receipt?.evidenceGaps).toContain(
    'No Proof Contract was supplied or found at .projscan/proof-contract.json.',
  );
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function recordProofCommands(
  commands: string[],
  exitCode: number,
  source?: 'prove-record' | 'prove-run' | 'mission' | 'external',
): Promise<void> {
  for (const command of commands) {
    await computeProve(tmp, {
      recordCommand: command,
      exitCode,
      durationMs: 100,
      summary: exitCode === 0 ? 'passed' : 'failed',
      recordSource: source,
    } as never);
  }
}
