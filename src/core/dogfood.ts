import { resolveDogfoodRepos } from './dogfoodDiscovery.js';
import {
  buildMarketValidation,
  DOGFOOD_WITH_FEEDBACK_COMMAND,
  FEEDBACK_CAPTURE_COMMAND,
} from './dogfoodMarketValidation.js';
import {
  evaluateDogfoodRepo,
  FEEDBACK_INIT_COMMAND,
  normalizeDogfoodFeedback,
} from './dogfoodRepoEvaluation.js';
import type {
  DogfoodFeedbackInput,
  DogfoodMarketValidation,
  DogfoodReport,
  DogfoodRepoDiscovery,
  DogfoodRepoResult,
} from '../types/dogfood.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';

export interface ComputeDogfoodOptions {
  repos?: string[];
  discoverRoots?: string[];
  targetRepoCount?: number;
  feedback?: DogfoodFeedbackInput;
}

const DEFAULT_TARGET_REPO_COUNT = 3;

export async function computeDogfoodReport(
  rootPath: string,
  options: ComputeDogfoodOptions = {},
): Promise<DogfoodReport> {
  const targetRepoCount = normalizeTargetRepoCount(options.targetRepoCount);
  const repoResolution = await resolveDogfoodRepos(rootPath, options, targetRepoCount);
  const repos = repoResolution.repos;
  const feedback = normalizeDogfoodFeedback(options.feedback);
  const results = await Promise.all(
    repos.map((repoPath) => evaluateDogfoodRepo(repoPath, feedback)),
  );
  const totals = summarizeTotals(results);
  const marketValidation = buildMarketValidation(results, targetRepoCount);
  return {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    targetRepoCount,
    summary: summarizeDogfood(results.length, targetRepoCount, totals, marketValidation),
    repos: results,
    totals,
    marketValidation,
    ...(repoResolution.discovery ? { repoDiscovery: repoResolution.discovery } : {}),
    suggestedNextActions: buildDogfoodActions(
      results.length,
      targetRepoCount,
      marketValidation,
      repoResolution.discovery,
      results[0]?.feedbackCaptureCommand,
    ),
  };
}

function normalizeTargetRepoCount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TARGET_REPO_COUNT;
  return Math.max(1, Math.floor(value));
}

function summarizeTotals(repos: DogfoodRepoResult[]): DogfoodReport['totals'] {
  return {
    reposEvaluated: repos.length,
    passingRepos: repos.filter((repo) => repo.status === 'pass').length,
    warningRepos: repos.filter((repo) => repo.status === 'warn').length,
    failingRepos: repos.filter((repo) => repo.status === 'fail').length,
    prCommentReady: repos.filter((repo) => repo.prCommentReady).length,
    repeatUseReady: repos.filter((repo) => repo.repeatUseReady).length,
    mcpReady: repos.filter((repo) => repo.mcpReady).length,
    usefulFeedback: repos.reduce((sum, repo) => sum + repo.validation.usefulResponses, 0),
    minutesSaved: repos.reduce((sum, repo) => sum + repo.validation.minutesSaved, 0),
    preventedBadEdits: repos.reduce((sum, repo) => sum + repo.validation.preventedBadEdits, 0),
    falsePositiveReports: repos.reduce(
      (sum, repo) => sum + repo.validation.falsePositiveRules.length,
      0,
    ),
  };
}

function summarizeDogfood(
  reposEvaluated: number,
  targetRepoCount: number,
  totals: DogfoodReport['totals'],
  marketValidation: DogfoodMarketValidation,
): string {
  const target = reposEvaluated >= targetRepoCount ? 'target met' : 'needs more repos';
  return (
    'dogfood: ' +
    reposEvaluated +
    ' repo(s) evaluated (' +
    target +
    '); ' +
    totals.prCommentReady +
    '/' +
    reposEvaluated +
    ' PR comments ready; ' +
    totals.repeatUseReady +
    '/' +
    reposEvaluated +
    ' repeat-use loops ready; validation=' +
    marketValidation.status
  );
}

function buildDogfoodActions(
  reposEvaluated: number,
  targetRepoCount: number,
  marketValidation: DogfoodMarketValidation,
  repoDiscovery: DogfoodRepoDiscovery | undefined,
  firstFeedbackCaptureCommand: string | undefined,
): PreflightSuggestedAction[] {
  const feedbackCaptureCommand = firstFeedbackCaptureCommand ?? FEEDBACK_CAPTURE_COMMAND;
  const actions: PreflightSuggestedAction[] = [
    {
      label: 'Run dogfood against a real team repo',
      command: 'projscan dogfood --repo <path-to-repo> --format json',
    },
    {
      label: 'Generate first-PR evidence for review',
      command: 'projscan evidence-pack --pr-comment',
    },
    {
      label: 'Initialize structured reviewer feedback',
      command: FEEDBACK_INIT_COMMAND,
    },
    {
      label: 'Capture reviewer feedback as structured evidence',
      command: feedbackCaptureCommand,
    },
    {
      label: 'Roll feedback into dogfood validation',
      command: DOGFOOD_WITH_FEEDBACK_COMMAND,
    },
  ];
  if (repoDiscovery) {
    actions.unshift({
      label: 'Repeat local repo discovery for dogfood validation',
      command: repoDiscovery.command,
    });
  }
  if (reposEvaluated < targetRepoCount) {
    actions.unshift({
      label:
        'Add ' +
        (targetRepoCount - reposEvaluated) +
        ' more repo(s) before calling adoption proven',
      command: 'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --format json',
    });
  }
  if (marketValidation.status === 'needs_feedback') {
    actions.unshift({
      label: 'Ask real reviewers for first-PR usefulness feedback',
      command: feedbackCaptureCommand,
    });
  }
  if (marketValidation.status === 'needs_tuning') {
    actions.unshift({
      label: 'Tune noisy rules before expanding rollout',
      command: 'projscan memory stable --format json',
    });
  }
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
