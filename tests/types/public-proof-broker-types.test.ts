import { expect, test } from 'vitest';
import { computeProofBroker } from '../../src/publicCore.js';
import type {
  ComputeProofBrokerOptions,
  ProofBrokerGap,
  ProofBrokerReport,
  ProofBrokerRequiredProof,
} from '../../src/types.js';

const options: ComputeProofBrokerOptions = {
  intent: 'change billing retry logic',
  saveContractPath: '.projscan/proof-contract.json',
  outputPassportPath: '.projscan/passport.json',
};

const requiredProof: ProofBrokerRequiredProof = {
  id: 'recipe:billing-retry-safety',
  surface: 'custom',
  status: 'missing',
  files: ['src/billing/retryPolicy.ts'],
  requiredCommands: ['npm run test:billing'],
  matchedCommands: [],
  requiredReview: 'require review from @billing-platform',
  reason: 'Billing retry changes need proof.',
  gaps: ['recipe:billing-retry-safety is missing proof.'],
  source: 'recipe',
  recipeId: 'billing-retry-safety',
  requiredReviewers: ['@billing-platform'],
};

const gap: ProofBrokerGap = {
  kind: 'missing-proof',
  severity: 'warning',
  message: 'recipe:billing-retry-safety needs proof command npm run test:billing.',
  command: 'npm run test:billing',
  requirementId: 'recipe:billing-retry-safety',
};

const report: ProofBrokerReport = {
  schemaVersion: 1,
  kind: 'proof-broker',
  generatedAt: '2026-06-28T00:00:00.000Z',
  status: 'needs-proof',
  summary: 'needs-proof: 1 proof gap remains before review.',
  intent: 'change billing retry logic',
  reviewer: {
    decision: 'needs-focused-review',
    action: 'run-proof',
    summary: 'Run the missing proof commands before review.',
  },
  requiredProof: [requiredProof],
  proof: {
    status: 'missing',
    sufficiencyStatus: 'missing',
    replayStatus: 'needs-proof',
    missingCommands: ['npm run test:billing'],
    failedCommands: [],
    staleCommands: [],
  },
  scope: {
    status: 'within-contract',
    changedFiles: ['src/billing/retryPolicy.ts'],
    riskyChangedFiles: ['src/billing/retryPolicy.ts'],
    forbiddenTouched: [],
    outsideAllowed: [],
    changedAfterProof: [],
  },
  requiredReviewers: ['@billing-platform'],
  gaps: [gap],
  recontract: {
    required: true,
    reason: 'A Proof Contract is required before review.',
    target: {
      effectiveWorktreePath: '/tmp/projscan-proof',
      effectiveWorktreeBranch: 'agent-b',
      effectiveWorktreeHead: '0123456789abcdef0123456789abcdef01234567',
    },
    driftFiles: ['package.json'],
    recommendedIntent: 'change billing retry logic',
    recommendedContractPath: '.projscan/proof-contract.json',
    followUpCommands: [
      'projscan prove --intent "change billing retry logic" --save-contract .projscan/proof-contract.json',
      'projscan prove --changed --contract .projscan/proof-contract.json --format markdown',
    ],
  },
  nextCommands: ['npm run test:billing'],
  warnings: [],
  artifacts: {
    contractPath: '.projscan/proof-contract.json',
    passportPath: '.projscan/passport.json',
  },
  prPassport: {
    title: 'Projscan PR Passport',
    sections: [
      'reviewer',
      'scope',
      'required-proof',
      'gaps',
      'reviewers',
      'recontract',
      'next-commands',
      'artifacts',
    ],
    markdown: '## Projscan PR Passport',
  },
  passport: {
    schemaVersion: 1,
    kind: 'agent-change-passport',
    generatedAt: '2026-06-28T00:00:00.000Z',
    status: 'needs-proof',
    summary: 'needs-proof: Run the missing proof commands before review.',
    boundary: {
      allowedFiles: ['src/billing/retryPolicy.ts'],
      forbiddenFiles: [],
      likelyTests: ['tests/billing/retryPolicy.test.ts'],
      riskyContracts: [],
      proofCommands: ['npm run test:billing'],
    },
    receipt: {
      scopeStatus: 'within-contract',
      proofStatus: 'missing',
      proofSufficiencyStatus: 'missing',
      proofReplayStatus: 'needs-proof',
      changedFiles: ['src/billing/retryPolicy.ts'],
      forbiddenTouched: [],
      outsideAllowed: [],
      changedAfterProof: [],
      missingCommands: ['npm run test:billing'],
      failedCommands: [],
      staleCommands: [],
      requiredReviewers: ['@billing-platform'],
    },
    reviewer: {
      decision: 'needs-focused-review',
      action: 'run-proof',
      summary: 'Run the missing proof commands before review.',
    },
    nextCommands: ['npm run test:billing'],
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
        staleProof: false,
        missingProof: true,
        failedProof: false,
      },
    },
  },
};

test('proof broker public API types compile from the barrels', () => {
  expect(typeof computeProofBroker).toBe('function');
  expect(options.outputPassportPath).toBe('.projscan/passport.json');
  expect(report.requiredProof[0].recipeId).toBe('billing-retry-safety');
  expect(report.gaps[0].kind).toBe('missing-proof');
});
