import { expect, test } from 'vitest';
import '../../src/types/dogfood.js';
import '../../src/types/trial.js';
import type {
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  DogfoodMarketValidation,
  DogfoodRepoDiscovery,
  DogfoodReport,
  DogfoodRepoResult,
  DogfoodRepoStatus,
  DogfoodRepoValidation,
  DogfoodWebsiteProof,
  FeedbackSummaryReport,
  FeedbackTemplateResult,
} from '../../src/types/dogfood.js';
import type { TrialReport, TrialVerdict } from '../../src/types/trial.js';
import type {
  DogfoodFeedbackInput as BarrelDogfoodFeedbackInput,
  DogfoodReport as BarrelDogfoodReport,
  FeedbackSummaryReport as BarrelFeedbackSummaryReport,
  TrialReport as BarrelTrialReport,
} from '../../src/types.js';
import type {
  DogfoodReport as EntryDogfoodReport,
  TrialReport as EntryTrialReport,
} from '../../src/index.js';

const repoStatus: DogfoodRepoStatus = 'pass';
const trialVerdict: TrialVerdict = 'pilot';

const response: DogfoodFeedbackResponse = {
  repo: 'projscan',
  pr: 'https://example.test/pr/42',
  reviewer: '@platform-reviewer',
  useful: true,
  minutesSaved: 15,
  preventedBadEdit: true,
  ownerRoutingClear: true,
  nextCommandClear: true,
  falsePositiveRules: [],
  missingSignals: [],
  noisyFindings: [],
  note: 'The PR evidence made the review faster.',
};

const feedbackInput: DogfoodFeedbackInput = {
  schemaVersion: 1,
  questions: ['Did the PR comment save time?'],
  responses: [response],
};

const template: FeedbackTemplateResult = {
  ...feedbackInput,
  schemaVersion: 1,
  path: '.projscan-feedback.json',
  createdAt: '2026-06-16T00:00:00.000Z',
  instructions: ['Record one response per real PR review.'],
};

const minutesSaved = {
  total: 15,
  average: 15,
  max: 15,
};

const repeatUse = {
  distinctPrs: 1,
  repeatedRepos: 0,
  requiredDistinctPrs: 3,
  requiredRepeatedRepos: 1,
  ready: false,
};

const falsePositive = {
  totalReports: 0,
  noisyRules: [],
  missingSignals: [],
  noisyFindings: [],
};

const feedbackSummary: FeedbackSummaryReport = {
  schemaVersion: 1,
  path: template.path,
  responses: 1,
  usefulResponses: 1,
  distinctRepos: 1,
  distinctPrs: 1,
  minutesSaved,
  preventedBadEdits: 1,
  ownerRoutingClear: 1,
  nextCommandClear: 1,
  repeatUse,
  falsePositive,
  nextDogfoodCommand: 'projscan dogfood --feedback .projscan-feedback.json --format json',
};

const validation: DogfoodRepoValidation = {
  feedbackResponses: 1,
  usefulResponses: 1,
  prRefs: ['https://example.test/pr/42'],
  minutesSaved: 15,
  preventedBadEdits: 1,
  ownerRoutingClear: 1,
  nextCommandClear: 1,
  falsePositiveRules: [],
  missingSignals: [],
  noisyFindings: [],
};

const websiteProof: DogfoodWebsiteProof = {
  headline: 'Projscan trial is useful on real PRs',
  metrics: ['1 useful response', '15 minutes saved'],
  bullets: ['Reviewer feedback is captured.'],
  markdown: '# Projscan trial is useful on real PRs',
};

const marketValidation: DogfoodMarketValidation = {
  status: 'needs_feedback',
  summary: 'More PR feedback is needed before adoption.',
  proofGates: [
    {
      id: 'reviewer-feedback',
      status: 'pass',
      summary: 'At least one reviewer submitted feedback.',
      command: 'projscan feedback summary --file .projscan-feedback.json --format json',
    },
  ],
  nextProofStep: 'Run the trial across more representative repositories.',
  repoCoverage: {
    target: 3,
    evaluated: 1,
    targetMet: false,
  },
  feedback: {
    responses: 1,
    usefulResponses: 1,
    usefulnessRate: 1,
    preventedBadEdits: 1,
    ownerRoutingClear: 1,
    nextCommandClear: 1,
    minutesSaved,
  },
  falsePositive,
  firstPr: {
    readyRepos: 1,
    repeatUseReadyRepos: 0,
    requiredFeedbackQuestions: ['Did the PR comment save time?'],
  },
  value: {
    averageMinutesSaved: 15,
    requiredAverageMinutesSaved: 10,
    preventedBadEdits: 1,
    ready: true,
  },
  repeatUse,
  websiteProof,
};

const repoDiscovery: DogfoodRepoDiscovery = {
  roots: ['/repos'],
  candidates: ['/repos/projscan', '/repos/api'],
  selected: ['/repos/projscan', '/repos/api'],
  targetRepoCount: 3,
  missingRepoCount: 1,
  command: 'projscan dogfood --discover /repos --target-repos 3 --format json',
};

const repoResult: DogfoodRepoResult = {
  path: '/repos/projscan',
  name: 'projscan',
  status: repoStatus,
  healthScore: 98,
  mcpReady: true,
  prCommentReady: true,
  repeatUseReady: false,
  verdict: 'caution',
  gaps: [],
  feedbackQuestions: ['Did the PR comment save time?'],
  validation,
  feedbackCaptureCommand:
    'projscan feedback add --file .projscan-feedback.json --repo projscan --pr <url>',
  nextCommands: ['projscan evidence-pack --pr-comment'],
};

const dogfoodReport: DogfoodReport = {
  schemaVersion: 1,
  readOnly: true,
  rootPath: '/repos/projscan',
  targetRepoCount: 3,
  summary: '1 repo evaluated with useful reviewer feedback.',
  repos: [repoResult],
  totals: {
    reposEvaluated: 1,
    passingRepos: 1,
    warningRepos: 0,
    failingRepos: 0,
    prCommentReady: 1,
    repeatUseReady: 0,
    mcpReady: 1,
    usefulFeedback: 1,
    minutesSaved: 15,
    preventedBadEdits: 1,
    falsePositiveReports: 0,
  },
  marketValidation,
  repoDiscovery,
  suggestedNextActions: [
    {
      label: 'Run the full adoption trial across repos',
      command: 'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --format json',
    },
  ],
};

const trialReport: TrialReport = {
  schemaVersion: 1,
  readOnly: true,
  rootPath: dogfoodReport.rootPath,
  verdict: trialVerdict,
  summary: 'Run more PR feedback before adoption.',
  activation: {
    status: 'warn',
    setupOverall: 'pass',
    healthScore: 98,
    mcpReady: true,
    adoptionLoopReady: false,
    firstPrCommand: 'projscan evidence-pack --pr-comment',
    feedbackCommand:
      'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url>',
  },
  feedback: feedbackSummary,
  dogfood: dogfoodReport,
  decision: {
    adoptable: false,
    reasons: ['repeat PR use is not proven yet'],
  },
  websiteProof,
  nextCommands: dogfoodReport.suggestedNextActions,
};

const barrelFeedbackInput: BarrelDogfoodFeedbackInput = feedbackInput;
const barrelFeedbackSummary: BarrelFeedbackSummaryReport = feedbackSummary;
const barrelDogfoodReport: BarrelDogfoodReport = dogfoodReport;
const barrelTrialReport: BarrelTrialReport = trialReport;
const entryDogfoodReport: EntryDogfoodReport = dogfoodReport;
const entryTrialReport: EntryTrialReport = trialReport;

void [
  barrelFeedbackInput,
  barrelFeedbackSummary,
  barrelDogfoodReport,
  barrelTrialReport,
  entryDogfoodReport,
];

test('dogfood and trial public types compile from modules, barrel, and package entrypoint', () => {
  expect(entryTrialReport.dogfood).toBe(dogfoodReport);
});
