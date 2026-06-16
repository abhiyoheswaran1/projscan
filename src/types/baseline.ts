import type { HealthScore } from './analysis.js';
import type { IssueSeverity } from './common.js';

export interface BaselineHotspot {
  relativePath: string;
  riskScore: number;
  churn: number;
}

export interface Baseline {
  score: number;
  grade: HealthScore['grade'];
  issues: { id: string; title: string; severity: IssueSeverity }[];
  hotspots?: BaselineHotspot[];
  issueRuleCounts?: Record<string, number>;
  timestamp: string;
}

export interface HotspotDelta {
  relativePath: string;
  beforeScore: number | null;
  afterScore: number | null;
  scoreDelta: number;
}

export interface HotspotDiffSummary {
  rose: HotspotDelta[];
  fell: HotspotDelta[];
  appeared: HotspotDelta[];
  resolved: HotspotDelta[];
}

export interface BaselineRecurringRule {
  id: string;
  before: number;
  after: number;
}

export interface BaselineTrend {
  scoreDirection: 'up' | 'down' | 'flat';
  scoreDelta: number;
  riskDirection?: 'up' | 'down' | 'flat';
  riskDelta?: number;
  qualityScoreBefore?: number;
  qualityScoreAfter?: number;
  newIssueCount?: number;
  resolvedIssueCount?: number;
  changedSinceBaseline?: string[];
  newHotspots: string[];
  recurringNoisyRules: BaselineRecurringRule[];
  summary: string;
}

export interface DiffResult {
  before: Baseline;
  after: Baseline;
  scoreDelta: number;
  newIssues: string[];
  resolvedIssues: string[];
  hotspotDiff?: HotspotDiffSummary;
  trend: BaselineTrend;
}
