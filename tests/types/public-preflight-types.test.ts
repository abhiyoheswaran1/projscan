import { expect, test } from 'vitest';
import '../../src/types/preflight.js';
import type {
  PreflightEvidence,
  PreflightMode,
  PreflightReason,
  PreflightReasonSource,
  PreflightReleaseScaleEvidence,
  PreflightReport,
  PreflightRequiredCheck,
  PreflightSuggestedAction,
  PreflightVerdict,
} from '../../src/types/preflight.js';
import type {
  PreflightEvidence as BarrelPreflightEvidence,
  PreflightMode as BarrelPreflightMode,
  PreflightReason as BarrelPreflightReason,
  PreflightReasonSource as BarrelPreflightReasonSource,
  PreflightReleaseScaleEvidence as BarrelPreflightReleaseScaleEvidence,
  PreflightReport as BarrelPreflightReport,
  PreflightRequiredCheck as BarrelPreflightRequiredCheck,
  PreflightSuggestedAction as BarrelPreflightSuggestedAction,
  PreflightVerdict as BarrelPreflightVerdict,
} from '../../src/types.js';

const mode: PreflightMode = 'before_commit';
const verdict: PreflightVerdict = 'caution';
const source: PreflightReasonSource = 'review';

const reason: PreflightReason = {
  severity: 'warning',
  source,
  message: 'Review needs a closer look.',
  file: 'src/types.ts',
  issueId: 'type-surface',
  tool: 'projscan_review',
};

const action: PreflightSuggestedAction = {
  label: 'Review changed public types',
  command: 'npm run typecheck',
  tool: 'projscan_review',
  args: { format: 'json' },
};

const requiredCheck: PreflightRequiredCheck = {
  name: 'typecheck',
  status: 'pass',
};

const releaseScale: PreflightReleaseScaleEvidence = {
  detected: true,
  changedFiles: 42,
  threshold: 30,
  reviewVerdict: 'review',
  reviewSummary: 'Release-scale review signal.',
  concreteBlockers: [],
  explanation: 'Large change requires human review.',
};

const evidence: PreflightEvidence = {
  health: {
    score: 100,
    grade: 'A',
    errors: 0,
    warnings: 0,
    infos: 0,
  },
  changedFiles: {
    available: true,
    count: 1,
    files: ['src/types.ts'],
  },
  review: {
    available: true,
    verdict: 'review',
    summary: 'Review signal.',
  },
  session: {
    kind: 'remembered-session',
    id: 'session-1',
    touchedFiles: ['src/types.ts'],
    totalTouchedFiles: 1,
    eventCount: 2,
    note: 'Compile-check session evidence.',
  },
  riskSources: {
    currentWorktree: {
      kind: 'current-worktree',
      available: true,
      count: 1,
      files: ['src/types.ts'],
      baseRef: 'origin/main',
    },
    sessionMemory: {
      kind: 'remembered-session',
      id: 'session-1',
      touchedFiles: ['src/types.ts'],
      totalTouchedFiles: 1,
      eventCount: 2,
      note: 'Compile-check session memory.',
    },
  },
  hotspots: { touched: [{ file: 'src/types.ts', riskScore: 180.9 }] },
  plugins: { enabled: false, errorIssues: 0, warningIssues: 0 },
  supplyChain: { errorIssues: 0, warningIssues: 0 },
  releaseScale,
  coordination: {
    available: true,
    readiness: 'caution',
    worktreeCount: 1,
    collisions: { high: 0, medium: 1 },
    contendedClaims: 0,
  },
};

const report: PreflightReport = {
  schemaVersion: 1,
  mode,
  verdict,
  summary: 'caution: review needs attention',
  reasons: [reason],
  evidence,
  requiredChecks: [requiredCheck],
  suggestedNextActions: [action],
  toolCalls: [action],
};

const barrelMode: BarrelPreflightMode = mode;
const barrelVerdict: BarrelPreflightVerdict = verdict;
const barrelSource: BarrelPreflightReasonSource = source;
const barrelReason: BarrelPreflightReason = reason;
const barrelAction: BarrelPreflightSuggestedAction = action;
const barrelRequiredCheck: BarrelPreflightRequiredCheck = requiredCheck;
const barrelReleaseScale: BarrelPreflightReleaseScaleEvidence = releaseScale;
const barrelEvidence: BarrelPreflightEvidence = evidence;
const barrelReport: BarrelPreflightReport = report;

void [
  barrelMode,
  barrelVerdict,
  barrelSource,
  barrelReason,
  barrelAction,
  barrelRequiredCheck,
  barrelReleaseScale,
  barrelEvidence,
  barrelReport,
];

test('preflight public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
});
