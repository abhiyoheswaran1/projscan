import { expect, test } from 'vitest';
import { computeReviewGate } from '../../src/publicCore.js';
import type {
  ComputeReviewGateOptions,
  ReviewGateProofDebtItem,
  ReviewGateReport,
} from '../../src/types.js';

const options: ComputeReviewGateOptions = {
  intent: 'change billing retry logic',
  saveContractPath: '.projscan/proof-contract.json',
  outputPassportPath: '.projscan/passport.json',
  outputPath: '.projscan/review-gate.json',
};

const debtItem: ReviewGateProofDebtItem = {
  id: 'missing-proof:npm run test:billing',
  kind: 'missing-proof',
  severity: 'warning',
  message: 'recipe:billing-retry-safety needs proof command npm run test:billing.',
  command: 'npm run test:billing',
  requirementId: 'recipe:billing-retry-safety',
  nextAction: 'Run npm run test:billing, then rerun projscan review-gate.',
};

const report: ReviewGateReport = {
  schemaVersion: 1,
  kind: 'review-gate',
  generatedAt: '2026-06-29T00:00:00.000Z',
  status: 'needs-proof',
  decision: {
    allowReview: false,
    outcome: 'needs-proof',
    summary: 'Review is not ready: 1 proof debt item remains.',
  },
  reviewer: {
    decision: 'needs-focused-review',
    action: 'run-proof',
    summary: 'Run the missing proof commands before review.',
  },
  proofDebt: {
    total: 1,
    blockers: 0,
    warnings: 1,
    byKind: {
      'missing-contract': 0,
      'scope-drift': 0,
      'missing-proof': 1,
      'failed-proof': 0,
      'stale-proof': 0,
      'weak-proof': 0,
      'recipe-gap': 0,
    },
    items: [debtItem],
  },
  recontract: {
    required: false,
    reason: 'Current change is inside the approved boundary.',
    driftFiles: [],
    command: 'projscan prove --intent "<change intent>" --save-contract .projscan/proof-contract.json',
  },
  requiredReviewers: ['@billing-platform'],
  nextCommands: ['npm run test:billing'],
  artifacts: {
    contractPath: '.projscan/proof-contract.json',
    passportPath: '.projscan/passport.json',
    reviewGatePath: '.projscan/review-gate.json',
  },
  prComment: {
    title: 'Projscan Review Gate',
    markdown: '## Projscan Review Gate',
  },
  proofBroker: {
    schemaVersion: 1,
    kind: 'proof-broker',
    generatedAt: '2026-06-29T00:00:00.000Z',
    status: 'needs-proof',
    summary: 'needs-proof: 1 proof gap remains before review.',
    reviewer: {
      decision: 'needs-focused-review',
      action: 'run-proof',
      summary: 'Run the missing proof commands before review.',
    },
    requiredProof: [],
    proof: {
      status: 'missing',
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
    gaps: [],
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
        'next-commands',
        'artifacts',
      ],
      markdown: '## Projscan PR Passport',
    },
    passport: {
      schemaVersion: 1,
      kind: 'agent-change-passport',
      generatedAt: '2026-06-29T00:00:00.000Z',
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
  },
};

test('review gate public API types compile from the barrels', () => {
  expect(typeof computeReviewGate).toBe('function');
  expect(options.outputPath).toBe('.projscan/review-gate.json');
  expect(report.proofDebt.items[0].kind).toBe('missing-proof');
});
