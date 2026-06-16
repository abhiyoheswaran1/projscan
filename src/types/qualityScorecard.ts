import type { HealthScore } from './analysis.js';
import type { PreflightSuggestedAction } from './preflight.js';
import type { FixFirstRecommendation, WorkplanPriority } from './workplan.js';

export type QualityScorecardVerdict = 'excellent' | 'healthy' | 'needs_attention' | 'blocked';
export type QualityScorecardStatus = 'pass' | 'watch' | 'fail';

export interface QualityScorecardDimension {
  id: 'health' | 'security' | 'tests' | 'maintainability' | 'coordination';
  label: string;
  status: QualityScorecardStatus;
  score: number;
  summary: string;
  evidence: string[];
  commands: string[];
}

export interface QualityScorecardRisk {
  id: string;
  priority: WorkplanPriority;
  title: string;
  files: string[];
  source: 'issue' | 'hotspot' | 'coordination';
  command: string;
}

export interface QualityScorecardReport {
  schemaVersion: 1;
  verdict: QualityScorecardVerdict;
  summary: string;
  health: HealthScore;
  dimensions: QualityScorecardDimension[];
  topRisks: QualityScorecardRisk[];
  fixFirst?: FixFirstRecommendation;
  commands: string[];
  suggestedNextActions: PreflightSuggestedAction[];
  truncated?: boolean;
}
