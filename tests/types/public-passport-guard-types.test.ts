import { expect, test } from 'vitest';
import type {
  AgentChangePassport,
  ComputeGuardOptions,
  ComputePassportOptions,
  GuardReport,
} from '../../src/types.js';

const passportOptions: ComputePassportOptions = {
  intent: 'implement password reset',
  saveContractPath: '.projscan/proof-contract.json',
  outputPath: '.projscan/passport.json',
};

const guardOptions: ComputeGuardOptions = {
  contractPath: '.projscan/proof-contract.json',
};

const passport: AgentChangePassport = {
  schemaVersion: 1,
  kind: 'agent-change-passport',
  generatedAt: '2026-06-27T00:00:00.000Z',
  status: 'needs-proof',
  intent: 'implement password reset',
  summary: 'needs-proof: Run the missing proof commands before review.',
  boundary: {
    contractId: 'proof-contract-implement-password-reset',
    allowedFiles: ['src/auth/passwordReset.ts'],
    forbiddenFiles: ['src/billing/**'],
    likelyTests: ['tests/auth/passwordReset.test.ts'],
    riskyContracts: ['public API/types'],
    proofCommands: ['npm test -- tests/auth/passwordReset.test.ts'],
    receiptCommand: 'projscan prove --changed --contract .projscan/proof-contract.json --format markdown',
  },
  receipt: {
    scopeStatus: 'within-contract',
    proofStatus: 'missing',
    proofSufficiencyStatus: 'missing',
    proofReplayStatus: 'needs-proof',
    changedFiles: ['src/auth/passwordReset.ts'],
    forbiddenTouched: [],
    outsideAllowed: [],
    changedAfterProof: [],
    missingCommands: ['npm test -- tests/auth/passwordReset.test.ts'],
    failedCommands: [],
    staleCommands: [],
    requiredReviewers: [],
  },
  reviewer: {
    decision: 'needs-focused-review',
    action: 'run-proof',
    summary: 'Run the missing proof commands before review.',
  },
  nextCommands: ['npm test -- tests/auth/passwordReset.test.ts'],
  warnings: [],
  artifacts: {
    contractPath: '.projscan/proof-contract.json',
    passportPath: '.projscan/passport.json',
  },
  prove: {
    verdict: 'needs-review',
    verifiedWorkflow: {
      phase: 'receipt',
      status: 'needs-review',
      nextAction: 'record proof before review',
      nextCommand: 'projscan prove --record-command "<command>" --exit-code 0 --duration-ms <ms>',
      scopeStatus: 'within-contract',
      proofStatus: 'missing',
      staleProof: false,
      missingProof: true,
      failedProof: false,
    },
  },
};

const guard: GuardReport = {
  schemaVersion: 1,
  kind: 'agent-scope-guard',
  status: 'attention',
  exitCode: 1,
  summary: 'attention: proof is missing.',
  reviewerAction: 'run-proof',
  drift: {
    status: 'within-contract',
    files: [],
    forbiddenTouched: [],
    outsideAllowed: [],
    changedAfterProof: [],
  },
  proof: {
    status: 'missing',
    sufficiencyStatus: 'missing',
    missingCommands: ['npm test -- tests/auth/passwordReset.test.ts'],
    failedCommands: [],
    staleCommands: [],
  },
  mutatedFiles: [],
};

test('passport and guard public types compile from the barrel', () => {
  expect(passportOptions.outputPath).toBe('.projscan/passport.json');
  expect(guardOptions.contractPath).toBe('.projscan/proof-contract.json');
  expect(passport.reviewer.action).toBe('run-proof');
  expect(guard.status).toBe('attention');
});
