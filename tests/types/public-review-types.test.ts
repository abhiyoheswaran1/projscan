import { expect, test } from 'vitest';
import '../../src/types/review.js';
import type {
  ReviewCycle,
  ReviewDataflowRisk,
  ReviewDependencyChange,
  ReviewFile,
  ReviewFunction,
  ReviewReport,
  ReviewTaintFlow,
  ReviewTier,
} from '../../src/types/review.js';
import type {
  ReviewReport as BarrelReviewReport,
  ReviewTier as BarrelReviewTier,
} from '../../src/types.js';
import type {
  ReviewReport as EntryReviewReport,
  ReviewTier as EntryReviewTier,
} from '../../src/index.js';

const tier: ReviewTier = 'summary';

const changedFile: ReviewFile = {
  relativePath: 'src/types.ts',
  status: 'modified',
  riskScore: 180.9,
  cyclomaticComplexity: 1,
  cyclomaticDelta: 0,
  exportsAdded: 1,
  exportsRemoved: 0,
  importsAdded: 1,
  importsRemoved: 0,
  intentAlignment: 'expected',
};

const cycle: ReviewCycle = {
  files: ['src/core/review.ts', 'src/types/review.ts'],
  size: 2,
  classification: 'new',
  intentAlignment: 'expected',
};

const riskyFunction: ReviewFunction = {
  file: 'src/core/review.ts',
  name: 'computeReview',
  line: 75,
  endLine: 320,
  cyclomaticComplexity: 12,
  baseCc: 8,
  reason: 'jumped',
  intentAlignment: 'expected',
};

const taintFlow: ReviewTaintFlow = {
  sourceFn: 'readSecret',
  sinkFn: 'sendPayload',
  source: 'env',
  sink: 'network',
  pathLength: 2,
  files: ['src/core/review.ts', 'src/core/dataflow.ts'],
  intentAlignment: 'unexpected',
};

const dataflowRisk: ReviewDataflowRisk = {
  kind: 'bridge',
  sourceFn: 'readSecret',
  sinkFn: 'sendPayload',
  bridgeFn: 'buildPayload',
  source: 'env',
  sink: 'network',
  pathLength: 3,
  files: ['src/core/review.ts', 'src/core/dataflow.ts'],
  severity: 'warning',
  confidence: 'high',
  intentAlignment: 'unexpected',
};

const dependencyChange: ReviewDependencyChange = {
  workspace: '',
  manifestFile: 'package.json',
  added: [{ name: 'agentloopkit', version: '^0.33.0', kind: 'dev' }],
  removed: [],
  bumped: [],
  intentAlignment: 'expected',
};

const report: ReviewReport = {
  available: true,
  base: { ref: 'origin/main', resolvedSha: 'base-sha' },
  head: { ref: 'HEAD', resolvedSha: 'head-sha' },
  prDiff: {
    available: true,
    base: { ref: 'origin/main', resolvedSha: 'base-sha' },
    head: { ref: 'HEAD', resolvedSha: 'head-sha' },
    filesAdded: [],
    filesRemoved: [],
    filesModified: [],
    totalFilesChanged: 1,
  },
  changedFiles: [changedFile],
  newCycles: [cycle],
  riskyFunctions: [riskyFunction],
  dependencyChanges: [dependencyChange],
  contractChanges: [
    {
      kind: 'export-added',
      file: 'src/types.ts',
      symbol: 'ReviewReport',
      confidence: 'high',
      why: 'Public review contract remains exported from the compatibility barrel.',
    },
  ],
  newTaintFlows: [taintFlow],
  newDataflowRisks: [dataflowRisk],
  graphEvidence: {
    schemaVersion: 1,
    changedFiles: 1,
    changedFunctions: 1,
    totalFunctions: 10,
    totalPackages: 1,
    totalCallEdges: 4,
    dataflowRisks: 1,
    topPackages: ['projscan'],
  },
  verdict: 'review',
  summary: ['Public review contracts compile from module and barrel imports.'],
  tier,
  intent: {
    raw: 'Extract review public types',
    action: 'refactor',
    scopeTokens: ['review', 'types'],
  },
  intentAnalysis: {
    totals: {
      expected: 3,
      unexpected: 2,
      'out-of-scope': 0,
      unknown: 0,
    },
    notable: [
      {
        kind: 'dataflow',
        label: 'readSecret -> sendPayload',
        alignment: 'unexpected',
        reason: 'Public type fixture covers review dataflow risk shape.',
      },
    ],
  },
};

const barrelTier: BarrelReviewTier = tier;
const barrelReport: BarrelReviewReport = report;
const entryTier: EntryReviewTier = tier;
const entryReport: EntryReviewReport = report;

void [barrelTier, barrelReport, entryTier];

test('review public types compile from module, barrel, and package entrypoint', () => {
  expect(entryReport.changedFiles[0]).toBe(changedFile);
});
