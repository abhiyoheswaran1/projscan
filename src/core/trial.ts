import path from 'node:path';

import { computeDogfoodReport, type ComputeDogfoodOptions } from './dogfood.js';
import { summarizeFeedback } from './feedback.js';
import { computeStartReport } from './start.js';
import type {
  DogfoodFeedbackInput,
  DogfoodReport,
  FeedbackSummaryReport,
} from '../types/dogfood.js';
import type { TrialReport, TrialVerdict } from '../types/trial.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { StartReport } from '../types/start.js';

export interface ComputeTrialOptions extends ComputeDogfoodOptions {
  feedbackPath?: string;
}

const FEEDBACK_PATH = '.projscan-feedback.json';
const EVIDENCE_COMMAND = 'projscan evidence-pack --pr-comment';
const PREFLIGHT_COMMAND = 'projscan preflight --mode before_merge --format json';
const FEEDBACK_INIT_COMMAND = 'projscan feedback init --output .projscan-feedback.json';
const FEEDBACK_ADD_COMMAND =
  'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10';
const FEEDBACK_SUMMARY_COMMAND =
  'projscan feedback summary --file .projscan-feedback.json --format json';
const DOGFOOD_COMMAND =
  'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json';

export async function computeTrialReport(
  rootPath: string,
  options: ComputeTrialOptions = {},
): Promise<TrialReport> {
  const feedback = normalizeFeedback(options.feedback);
  const activationRoot =
    options.repos && options.repos.length > 0 ? path.resolve(rootPath, options.repos[0]) : rootPath;
  const [start, dogfood] = await Promise.all([
    computeStartReport(activationRoot, { mode: 'before_merge', maxTasks: 4, maxRisks: 5 }),
    computeDogfoodReport(rootPath, options),
  ]);
  const feedbackSummary = feedback
    ? summarizeFeedback(feedback.responses, options.feedbackPath ?? FEEDBACK_PATH)
    : undefined;
  const activation = buildActivation(start, dogfood);
  const decision = buildDecision(dogfood, feedbackSummary);
  return {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    verdict: decision.verdict,
    summary: summarizeTrial(decision.verdict, dogfood),
    activation,
    ...(feedbackSummary ? { feedback: feedbackSummary } : {}),
    dogfood,
    decision: {
      adoptable: decision.verdict === 'adopt',
      reasons: decision.reasons,
    },
    websiteProof: dogfood.marketValidation.websiteProof,
    nextCommands: buildNextCommands(decision.verdict, dogfood, feedbackSummary),
  };
}

function normalizeFeedback(
  feedback: DogfoodFeedbackInput | undefined,
): DogfoodFeedbackInput | undefined {
  if (!feedback || !Array.isArray(feedback.responses)) return undefined;
  return feedback;
}

function buildActivation(start: StartReport, dogfood: DogfoodReport): TrialReport['activation'] {
  const reposEvaluated = Math.max(1, dogfood.totals.reposEvaluated);
  const healthScore =
    dogfood.repos.length > 0
      ? Math.min(...dogfood.repos.map((repo) => repo.healthScore))
      : start.evidence.healthScore;
  const mcpReady = dogfood.totals.mcpReady === reposEvaluated;
  const adoptionLoopReady = dogfood.totals.repeatUseReady === reposEvaluated;
  const status = activationStatus(healthScore, mcpReady, adoptionLoopReady);
  return {
    status,
    setupOverall: normalizeSetupOverall(start.setup.overall),
    healthScore,
    mcpReady,
    adoptionLoopReady,
    firstPrCommand: EVIDENCE_COMMAND,
    feedbackCommand: FEEDBACK_ADD_COMMAND,
  };
}

function normalizeSetupOverall(status: StartReport['setup']['overall']): 'pass' | 'warn' | 'fail' {
  if (status === 'fail' || status === 'warn') return status;
  return 'pass';
}

function activationStatus(
  healthScore: number,
  mcpReady: boolean,
  adoptionLoopReady: boolean,
): 'pass' | 'warn' | 'fail' {
  if (healthScore < 70) return 'fail';
  if (!mcpReady || !adoptionLoopReady || healthScore < 90) return 'warn';
  return 'pass';
}

function buildDecision(
  dogfood: DogfoodReport,
  feedback: FeedbackSummaryReport | undefined,
): { verdict: TrialVerdict; reasons: string[] } {
  const reasons: string[] = [];
  if (!dogfood.marketValidation.repoCoverage.targetMet)
    reasons.push('not enough representative repos evaluated');
  if (!feedback || feedback.responses === 0)
    reasons.push('reviewer feedback has not been captured');
  if (feedback && !dogfood.marketValidation.value.ready)
    reasons.push('measured value is not proven yet');
  if (feedback && !dogfood.marketValidation.repeatUse.ready)
    reasons.push('repeat PR use is not proven yet');
  if (
    dogfood.marketValidation.falsePositive.totalReports >
    dogfood.marketValidation.feedback.usefulResponses
  ) {
    reasons.push('false-positive reports outnumber useful responses');
  }
  if (dogfood.marketValidation.status === 'proven' && reasons.length === 0) {
    return { verdict: 'adopt', reasons: ['trial is adoption-ready'] };
  }
  if (dogfood.marketValidation.status === 'needs_tuning') return { verdict: 'tune', reasons };
  return { verdict: 'pilot', reasons };
}

function summarizeTrial(verdict: TrialVerdict, dogfood: DogfoodReport): string {
  const base =
    dogfood.totals.reposEvaluated +
    ' repo(s), market validation=' +
    dogfood.marketValidation.status;
  if (verdict === 'adopt') return 'adopt: projscan trial is ready for repeat PR use (' + base + ')';
  if (verdict === 'setup')
    return 'setup: fix onboarding or health before trial expansion (' + base + ')';
  if (verdict === 'tune')
    return (
      'tune: measured trial evidence exists but needs trust or repeat-use fixes (' + base + ')'
    );
  return 'pilot: run more PR feedback before calling the product adopted (' + base + ')';
}

function buildNextCommands(
  verdict: TrialVerdict,
  dogfood: DogfoodReport,
  feedback: FeedbackSummaryReport | undefined,
): PreflightSuggestedAction[] {
  const actions: PreflightSuggestedAction[] = [
    { label: 'Generate the first useful PR comment', command: EVIDENCE_COMMAND },
    { label: 'Run preflight before merge', command: PREFLIGHT_COMMAND },
  ];
  if (!feedback)
    actions.push({ label: 'Initialize reviewer feedback capture', command: FEEDBACK_INIT_COMMAND });
  if (!feedback || feedback.responses === 0)
    actions.push({ label: 'Capture reviewer feedback', command: FEEDBACK_ADD_COMMAND });
  if (feedback)
    actions.push({ label: 'Summarize feedback evidence', command: FEEDBACK_SUMMARY_COMMAND });
  if (
    !dogfood.marketValidation.repoCoverage.targetMet ||
    dogfood.marketValidation.status !== 'proven'
  ) {
    actions.push({ label: 'Run the full adoption trial across repos', command: DOGFOOD_COMMAND });
  }
  if (verdict === 'tune')
    actions.push({
      label: 'Inspect recurring noisy rules',
      command: 'projscan memory stable --format json',
    });
  return dedupeActions(actions);
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const result: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = action.command ?? action.label;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}
