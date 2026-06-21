import { expect, test } from 'vitest';
import '../../src/types/bugHunt.js';
import type { BugHuntFinding, BugHuntReport, BugHuntVerdict } from '../../src/types/bugHunt.js';
import type {
  BugHuntFinding as BarrelBugHuntFinding,
  BugHuntReport as BarrelBugHuntReport,
  BugHuntVerdict as BarrelBugHuntVerdict,
} from '../../src/types.js';

const verdict: BugHuntVerdict = 'fix';
const reviewVerdict: BugHuntVerdict = 'review';

const finding: BugHuntFinding = {
  id: 'bh-public-types',
  priority: 'p1',
  source: 'verification',
  title: 'Verify Bug Hunt public type exports',
  why: 'Downstream callers depend on stable Bug Hunt report shapes.',
  files: ['src/types.ts', 'src/types/bugHunt.ts'],
  evidence: [
    {
      source: 'verification',
      message: 'Compile-check the module and barrel paths.',
      severity: 'warning',
      file: 'src/types.ts',
      tool: 'typecheck',
    },
  ],
  suggestedTools: ['projscan_bug_hunt'],
  verification: {
    commands: ['npm run typecheck'],
    expected: 'Bug Hunt types compile from the module and legacy barrel.',
  },
};

const report: BugHuntReport = {
  schemaVersion: 1,
  verdict,
  summary: 'Bug Hunt public types compile from a focused module.',
  health: {
    score: 100,
    grade: 'A',
    errors: 0,
    warnings: 0,
    infos: 0,
  },
  evidence: {
    issueCounts: {
      errors: 0,
      warnings: 1,
      infos: 0,
    },
    hotspotCount: 1,
    preflightVerdict: 'caution',
    preflightActionableReasonCount: 1,
    preflightIgnoredReasonCount: 0,
    touchedFiles: ['src/types.ts'],
    conflicts: 0,
  },
  topSuspects: [finding],
  fixQueue: [finding],
  reviewQueue: [],
  fixFirst: {
    id: finding.id,
    title: finding.title,
    source: 'quality-scorecard',
    priority: finding.priority,
    whyFirst: finding.why,
    files: finding.files,
    commands: finding.verification.commands,
    expected: finding.verification.expected,
  },
  verificationMatrix: [
    {
      command: 'npm run typecheck',
      reason: 'Public type compatibility',
      expected: 'TypeScript accepts Bug Hunt module and barrel imports.',
    },
  ],
};

const legacyReportWithoutReviewQueue: BugHuntReport = {
  schemaVersion: 1,
  verdict: reviewVerdict,
  summary: 'Existing consumers can still construct Bug Hunt reports without reviewQueue.',
  health: {
    score: 100,
    grade: 'A',
    errors: 0,
    warnings: 0,
    infos: 0,
  },
  evidence: {
    issueCounts: {
      errors: 0,
      warnings: 0,
      infos: 0,
    },
    hotspotCount: 0,
    preflightVerdict: 'proceed',
    touchedFiles: [],
    conflicts: 0,
  },
  topSuspects: [],
  fixQueue: [],
  verificationMatrix: [],
};

const barrelVerdict: BarrelBugHuntVerdict = verdict;
const barrelFinding: BarrelBugHuntFinding = finding;
const barrelReport: BarrelBugHuntReport = report;

void [barrelVerdict, barrelFinding, reviewVerdict, legacyReportWithoutReviewQueue];

test('bug hunt public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
});
