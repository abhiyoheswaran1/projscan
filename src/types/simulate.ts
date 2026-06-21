import type { RiskDeltaSnapshot } from './assess.js';

export type SimulateVerdict = 'worth-doing' | 'needs-more-evidence' | 'not-worth-it-yet';
export type SimulateConfidence = 'high' | 'medium' | 'low';

export interface SimulateCandidateGraph {
  fanIn: number;
  fanOut: number;
  directImporters: string[];
}

export interface SimulateCandidateFile {
  path: string;
  score: number;
  reasons: string[];
  graph?: SimulateCandidateGraph;
  qualityRisk?: string;
}

export interface SimulateEvidence {
  source: string;
  detail: string;
  file?: string;
  command?: string;
}

export interface SimulateRolloutStep {
  title: string;
  detail: string;
  commands: string[];
}

export interface SimulateReport {
  schemaVersion: 1;
  plan: string;
  verdict: SimulateVerdict;
  confidence: SimulateConfidence;
  summary: string;
  filesLikelyTouched: SimulateCandidateFile[];
  testsLikelyAffected: string[];
  contractsLikelyAffected: string[];
  riskDelta: RiskDeltaSnapshot;
  rolloutPlan: SimulateRolloutStep[];
  proofCommands: string[];
  evidence: SimulateEvidence[];
  warnings: string[];
}

