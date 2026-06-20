import type { EvidencePackVerdict } from './evidencePack.js';
import type { PreflightSuggestedAction } from './preflight.js';

export type DogfoodRepoStatus = 'pass' | 'warn' | 'fail';

export interface DogfoodFeedbackResponse {
  repo?: string;
  pr?: string;
  reviewer?: string;
  useful?: boolean;
  minutesSaved?: number;
  preventedBadEdit?: boolean;
  ownerRoutingClear?: boolean;
  nextCommandClear?: boolean;
  falsePositiveRules?: string[];
  missingSignals?: string[];
  noisyFindings?: string[];
  note?: string;
}

export interface DogfoodFeedbackInput {
  schemaVersion?: 1;
  questions?: string[];
  responses: DogfoodFeedbackResponse[];
}

export interface FeedbackTemplateResult extends DogfoodFeedbackInput {
  schemaVersion: 1;
  path: string;
  createdAt: string;
  instructions: string[];
}

export interface FeedbackSummaryReport {
  schemaVersion: 1;
  path: string;
  responses: number;
  usefulResponses: number;
  distinctRepos: number;
  distinctPrs: number;
  minutesSaved: {
    total: number;
    average: number;
    max: number;
  };
  preventedBadEdits: number;
  ownerRoutingClear: number;
  nextCommandClear: number;
  repeatUse: {
    distinctPrs: number;
    repeatedRepos: number;
    requiredDistinctPrs: number;
    requiredRepeatedRepos: number;
    ready: boolean;
  };
  falsePositive: {
    totalReports: number;
    noisyRules: Array<{ rule: string; count: number }>;
    missingSignals: Array<{ signal: string; count: number }>;
    noisyFindings: Array<{ finding: string; count: number }>;
  };
  nextDogfoodCommand: string;
}

export type FeedbackIntakeCategory =
  | 'false_positive'
  | 'noisy_caution'
  | 'install_warning'
  | 'missing_framework_rule'
  | 'confusing_docs_output'
  | 'useful_signal'
  | 'uncategorized';

export type FeedbackIntakeConfidence = 'high' | 'medium' | 'low';

export interface FeedbackIntakeReport {
  schemaVersion: 1;
  category: FeedbackIntakeCategory;
  confidence: FeedbackIntakeConfidence;
  summary: string;
  evidence: string[];
  taskTitle: string;
  suggestedCommand: string;
  nextCommand: string;
  agentloopTaskCommand: string;
  followUpCommands: string[];
  feedbackSummaryCommand?: string;
  dogfoodCommand?: string;
  feedbackResponse: DogfoodFeedbackResponse;
  appended?: {
    path: string;
    responses: number;
  };
}

export interface DogfoodRepoValidation {
  feedbackResponses: number;
  usefulResponses: number;
  prRefs: string[];
  minutesSaved: number;
  preventedBadEdits: number;
  ownerRoutingClear: number;
  nextCommandClear: number;
  falsePositiveRules: string[];
  missingSignals: string[];
  noisyFindings: string[];
}

export interface DogfoodWebsiteProof {
  headline: string;
  metrics: string[];
  bullets: string[];
  markdown: string;
}

export interface DogfoodRepoDiscovery {
  roots: string[];
  candidates: string[];
  selected: string[];
  targetRepoCount: number;
  missingRepoCount: number;
  command: string;
}

export interface DogfoodMarketValidation {
  status: 'proven' | 'needs_feedback' | 'needs_more_repos' | 'needs_tuning';
  summary: string;
  proofGates: Array<{
    id:
      | 'repo-coverage'
      | 'reviewer-feedback'
      | 'useful-feedback'
      | 'repeat-use'
      | 'measured-value'
      | 'false-positive-balance';
    status: 'pass' | 'fail';
    summary: string;
    command: string;
  }>;
  nextProofStep: string;
  repoCoverage: {
    target: number;
    evaluated: number;
    targetMet: boolean;
  };
  feedback: {
    responses: number;
    usefulResponses: number;
    usefulnessRate: number;
    preventedBadEdits: number;
    ownerRoutingClear: number;
    nextCommandClear: number;
    minutesSaved: {
      total: number;
      average: number;
      max: number;
    };
  };
  falsePositive: {
    totalReports: number;
    noisyRules: Array<{ rule: string; count: number }>;
    missingSignals: Array<{ signal: string; count: number }>;
    noisyFindings: Array<{ finding: string; count: number }>;
  };
  firstPr: {
    readyRepos: number;
    repeatUseReadyRepos: number;
    requiredFeedbackQuestions: string[];
  };
  value: {
    averageMinutesSaved: number;
    requiredAverageMinutesSaved: number;
    preventedBadEdits: number;
    ready: boolean;
  };
  repeatUse: {
    distinctPrs: number;
    repeatedRepos: number;
    requiredDistinctPrs: number;
    requiredRepeatedRepos: number;
    ready: boolean;
  };
  websiteProof: DogfoodWebsiteProof;
}

export interface DogfoodRepoResult {
  path: string;
  name: string;
  status: DogfoodRepoStatus;
  healthScore: number;
  mcpReady: boolean;
  prCommentReady: boolean;
  repeatUseReady: boolean;
  verdict: EvidencePackVerdict;
  gaps: string[];
  feedbackQuestions: string[];
  validation: DogfoodRepoValidation;
  feedbackCaptureCommand?: string;
  nextCommands: string[];
}

export interface DogfoodReport {
  schemaVersion: 1;
  readOnly: true;
  rootPath: string;
  targetRepoCount: number;
  summary: string;
  repos: DogfoodRepoResult[];
  totals: {
    reposEvaluated: number;
    passingRepos: number;
    warningRepos: number;
    failingRepos: number;
    prCommentReady: number;
    repeatUseReady: number;
    mcpReady: number;
    usefulFeedback: number;
    minutesSaved: number;
    preventedBadEdits: number;
    falsePositiveReports: number;
  };
  marketValidation: DogfoodMarketValidation;
  repoDiscovery?: DogfoodRepoDiscovery;
  suggestedNextActions: PreflightSuggestedAction[];
}
