import { expect, test } from 'vitest';
import type {
  Baseline,
  BaselineHotspot,
  BaselineRecurringRule,
  BaselineTrend,
  DiffResult,
  HotspotDelta,
  HotspotDiffSummary,
} from '../../src/types/baseline.js';
import type {
  Baseline as BarrelBaseline,
  BaselineHotspot as BarrelBaselineHotspot,
  BaselineRecurringRule as BarrelBaselineRecurringRule,
  BaselineTrend as BarrelBaselineTrend,
  DiffResult as BarrelDiffResult,
  HotspotDelta as BarrelHotspotDelta,
  HotspotDiffSummary as BarrelHotspotDiffSummary,
} from '../../src/types.js';

const hotspot: BaselineHotspot = {
  relativePath: 'src/types.ts',
  riskScore: 405,
  churn: 71,
};

const baseline: Baseline = {
  score: 100,
  grade: 'A',
  issues: [{ id: 'compile-check', title: 'Compile check', severity: 'info' }],
  hotspots: [hotspot],
  issueRuleCounts: { 'compile-check': 1 },
  timestamp: '2026-06-16T00:00:00.000Z',
};

const hotspotDelta: HotspotDelta = {
  relativePath: hotspot.relativePath,
  beforeScore: 407,
  afterScore: hotspot.riskScore,
  scoreDelta: -2,
};

const hotspotDiff: HotspotDiffSummary = {
  rose: [],
  fell: [hotspotDelta],
  appeared: [],
  resolved: [],
};

const recurringRule: BaselineRecurringRule = {
  id: 'compile-check',
  before: 1,
  after: 1,
};

const trend: BaselineTrend = {
  scoreDirection: 'flat',
  scoreDelta: 0,
  riskDirection: 'down',
  riskDelta: -2,
  qualityScoreBefore: 100,
  qualityScoreAfter: 100,
  newIssueCount: 0,
  resolvedIssueCount: 0,
  changedSinceBaseline: ['src/types.ts'],
  newHotspots: [],
  recurringNoisyRules: [recurringRule],
  summary: 'Compile-check baseline trend shape.',
};

const diff: DiffResult = {
  before: baseline,
  after: {
    ...baseline,
    hotspots: [{ ...hotspot, riskScore: 405 }],
  },
  scoreDelta: 0,
  newIssues: [],
  resolvedIssues: [],
  hotspotDiff,
  trend,
};

const barrelHotspot: BarrelBaselineHotspot = hotspot;
const barrelBaseline: BarrelBaseline = baseline;
const barrelHotspotDelta: BarrelHotspotDelta = hotspotDelta;
const barrelHotspotDiff: BarrelHotspotDiffSummary = hotspotDiff;
const barrelRecurringRule: BarrelBaselineRecurringRule = recurringRule;
const barrelTrend: BarrelBaselineTrend = trend;
const barrelDiff: BarrelDiffResult = diff;

void [
  barrelHotspot,
  barrelBaseline,
  barrelHotspotDelta,
  barrelHotspotDiff,
  barrelRecurringRule,
  barrelTrend,
  barrelDiff,
];

test('baseline public types compile from the module and legacy barrel', () => {
  expect(barrelDiff).toBe(diff);
});
