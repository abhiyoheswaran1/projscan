import { expect, test } from 'vitest';
import { buildEvidencePackPrSummary } from '../../src/core/releaseEvidencePrSummary.js';
import type { BugHuntReport, PreflightReport, WorkplanReport } from '../../src/types.js';

test('builds PR summary with owner routes, fix-first, and manual-review trust', () => {
  const preflight: PreflightReport = {
    schemaVersion: 1,
    mode: 'before_merge',
    verdict: 'block',
    summary: 'block: release-scale review required',
    reasons: [
      {
        severity: 'warning',
        source: 'changed-files',
        message: '70 changed files exceeds the preflight threshold of 50',
        tool: 'projscan_review',
      },
      {
        severity: 'error',
        source: 'review',
        message: 'Review verdict is block due to scale/complexity risk: high changed-file risk.',
        tool: 'projscan_review',
      },
    ],
    evidence: {
      changedFiles: {
        available: true,
        count: 2,
        files: [' M src/payments/checkout.ts', '?? docs/release.md'],
      },
      releaseScale: {
        detected: true,
        changedFiles: 70,
        threshold: 50,
        reviewVerdict: 'block',
        reviewSummary: 'high changed-file risk',
        concreteBlockers: [],
        explanation: 'Large platform release risk: 70 changed files exceeds the threshold.',
      },
    },
    requiredChecks: [],
    suggestedNextActions: [],
    toolCalls: [],
  };
  const workplan: WorkplanReport = {
    schemaVersion: 1,
    mode: 'release',
    verdict: 'block',
    summary: 'review release risk',
    topRisks: [
      {
        priority: 'p1',
        source: 'hotspots',
        message: 'Review checkout hotspot before approval',
        file: 'src/payments/checkout.ts',
        tool: 'projscan_hotspots',
      },
    ],
    tasks: [],
    coordination: {
      touchedFiles: [],
      conflicts: [],
      recommendedNextAgent: 'projscan workplan --mode release',
    },
    suggestedNextActions: [],
  };
  const bugHunt: BugHuntReport = {
    schemaVersion: 1,
    verdict: 'clean',
    summary: 'clean',
    health: { score: 100, grade: 'A', errors: 0, warnings: 0, infos: 0 },
    evidence: {
      issueCounts: { errors: 0, warnings: 0, infos: 0 },
      hotspotCount: 0,
      preflightVerdict: 'proceed',
      touchedFiles: [],
      conflicts: 0,
    },
    topSuspects: [],
    fixQueue: [],
    verificationMatrix: [],
  };

  const summary = buildEvidencePackPrSummary({
    workplan,
    bugHunt,
    preflight,
    nextActions: [{ label: 'Run focused preflight', command: 'projscan preflight --format json' }],
    ownership: (file) => (file.startsWith('src/payments/') ? '@payments' : undefined),
  });

  expect(summary.verdictLabel).toBe('Manual review');
  expect(summary.trust.verdict).toBe('manual_review');
  expect(summary.topRisks[0]).toMatchObject({
    title: 'Review checkout hotspot before approval',
    owner: '@payments',
    command: 'projscan hotspots --format json',
  });
  expect(summary.teamRoutes).toEqual([
    {
      owner: '@payments',
      files: ['src/payments/checkout.ts'],
      reason: 'owns one or more top PR risks; owns changed file(s) in this PR',
    },
  ]);
  expect(summary.fixFirst).toMatchObject({
    title: 'Review checkout hotspot before approval',
    owner: '@payments',
    source: 'pr-risk',
  });
  expect(summary.nextCommands).toEqual([
    'projscan preflight --mode before_merge --format json',
    'projscan preflight --format json',
  ]);
});
