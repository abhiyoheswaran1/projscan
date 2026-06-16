import type { DogfoodReport, DogfoodWebsiteProof, FeedbackSummaryReport } from './dogfood.js';
import type { PreflightSuggestedAction } from './preflight.js';

export type TrialVerdict = 'adopt' | 'pilot' | 'tune' | 'setup';

export interface TrialReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  verdict: TrialVerdict;
  summary: string;
  activation: {
    status: 'pass' | 'warn' | 'fail';
    setupOverall: 'pass' | 'warn' | 'fail';
    healthScore: number;
    mcpReady: boolean;
    adoptionLoopReady: boolean;
    firstPrCommand: string;
    feedbackCommand: string;
  };
  feedback?: FeedbackSummaryReport;
  dogfood: DogfoodReport;
  decision: {
    adoptable: boolean;
    reasons: string[];
  };
  websiteProof: DogfoodWebsiteProof;
  nextCommands: PreflightSuggestedAction[];
}
