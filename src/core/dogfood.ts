import path from 'node:path';

import { MIN_REPEAT_FEEDBACK_PRS, MIN_REPEAT_FEEDBACK_REPOS } from './feedback.js';
import { computeEvidencePack } from './releaseEvidence.js';
import { computeStartReport } from './start.js';
import type {
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  DogfoodMarketValidation,
  DogfoodReport,
  DogfoodRepoResult,
  DogfoodRepoStatus,
  DogfoodRepoValidation,
} from '../types/dogfood.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';

export interface ComputeDogfoodOptions {
  repos?: string[];
  targetRepoCount?: number;
  feedback?: DogfoodFeedbackInput;
}

const DEFAULT_TARGET_REPO_COUNT = 3;
const FEEDBACK_QUESTIONS = [
  'Did the PR comment save 10-20 minutes?',
  'What was missing or noisy?',
  'Which owner or command should have been clearer?',
  'Minutes saved: 0, 5, 10, 20+?',
  'Did projscan prevent a risky edit or missed review step?',
] as const;
const FEEDBACK_INIT_COMMAND = 'projscan feedback init --output .projscan-feedback.json';
const FEEDBACK_CAPTURE_COMMAND =
  'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10';
const DOGFOOD_WITH_FEEDBACK_COMMAND =
  'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json';
const MIN_USEFUL_REVIEWER_RESPONSES = 3;
const MIN_AVERAGE_MINUTES_SAVED = 10;

export async function computeDogfoodReport(
  rootPath: string,
  options: ComputeDogfoodOptions = {},
): Promise<DogfoodReport> {
  const targetRepoCount = normalizeTargetRepoCount(options.targetRepoCount);
  const repos = normalizeRepos(rootPath, options.repos);
  const feedback = normalizeFeedback(options.feedback);
  const results = await Promise.all(repos.map((repoPath) => evaluateRepo(repoPath, feedback)));
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
    suggestedNextActions: buildDogfoodActions(results.length, targetRepoCount, marketValidation),
  };
}

async function evaluateRepo(
  repoPath: string,
  feedback: DogfoodFeedbackResponse[],
): Promise<DogfoodRepoResult> {
  const [start, evidence] = await Promise.all([
    computeStartReport(repoPath, { mode: 'before_merge', maxTasks: 4, maxRisks: 5 }),
    computeEvidencePack(repoPath, { includePrComment: true, maxFindings: 3 }),
  ]);
  const name = path.basename(repoPath) || repoPath;
  const prComment = evidence.prComment ?? '';
  const prCommentReady =
    evidence.prCommentValidation?.status === 'pass' && prComment.includes('### Developer Feedback');
  const repeatUseReady =
    start.adoptionLoop?.cadence === 'every_pr' &&
    (start.adoptionLoop.nextCommands.length ?? 0) >= 3;
  const mcpReady = start.evidence.mcpReady;
  const validation = summarizeRepoFeedback(feedbackForRepo(feedback, repoPath, name));
  const gaps = buildGaps({
    prCommentReady,
    repeatUseReady,
    mcpReady,
    healthScore: start.evidence.healthScore,
    validation,
  });
  return {
    path: repoPath,
    name,
    status: statusFromGaps(gaps, start.evidence.healthScore),
    healthScore: start.evidence.healthScore,
    mcpReady,
    prCommentReady,
    repeatUseReady,
    verdict: evidence.verdict,
    gaps,
    feedbackQuestions: [...FEEDBACK_QUESTIONS],
    validation,
    nextCommands: [
      'projscan init team --team platform',
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      FEEDBACK_INIT_COMMAND,
      FEEDBACK_CAPTURE_COMMAND,
      DOGFOOD_WITH_FEEDBACK_COMMAND,
    ],
  };
}

function normalizeTargetRepoCount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TARGET_REPO_COUNT;
  return Math.max(1, Math.floor(value));
}

function normalizeRepos(rootPath: string, repos: string[] | undefined): string[] {
  const values = repos && repos.length > 0 ? repos : [rootPath];
  return [...new Set(values.map((value) => path.resolve(rootPath, value)))];
}

function normalizeFeedback(input: DogfoodFeedbackInput | undefined): DogfoodFeedbackResponse[] {
  return Array.isArray(input?.responses) ? input.responses : [];
}

function feedbackForRepo(
  feedback: DogfoodFeedbackResponse[],
  repoPath: string,
  repoName: string,
): DogfoodFeedbackResponse[] {
  const normalizedPath = normalizeMatchValue(repoPath);
  const normalizedName = normalizeMatchValue(repoName);
  return feedback.filter((response) => {
    const repo = normalizeMatchValue(response.repo ?? '');
    if (!repo) return false;
    return matchesRepoKey(repo, normalizedName, normalizedPath);
  });
}

function matchesRepoKey(repo: string, repoName: string, repoPath: string): boolean {
  if (repo === repoName || repo === repoPath || repoPath.endsWith('/' + repo)) return true;
  if (repoName.startsWith(repo + '-') || repoName.endsWith('-' + repo)) return true;
  if (repoName.includes('-' + repo + '-')) return true;
  if (repoPath.includes('/' + repo + '-') || repoPath.includes('/' + repo + '/')) return true;
  return repoPath.includes('-' + repo + '-');
}

function summarizeRepoFeedback(feedback: DogfoodFeedbackResponse[]): DogfoodRepoValidation {
  return {
    feedbackResponses: feedback.length,
    usefulResponses: feedback.filter((response) => response.useful === true).length,
    prRefs: cleanSignals(feedback.map((response) => response.pr ?? '')),
    minutesSaved: sumNumbers(feedback.map((response) => response.minutesSaved)),
    preventedBadEdits: feedback.filter((response) => response.preventedBadEdit === true).length,
    ownerRoutingClear: feedback.filter((response) => response.ownerRoutingClear === true).length,
    nextCommandClear: feedback.filter((response) => response.nextCommandClear === true).length,
    falsePositiveRules: cleanSignals(
      feedback.flatMap((response) => response.falsePositiveRules ?? []),
    ),
    missingSignals: cleanSignals(feedback.flatMap((response) => response.missingSignals ?? [])),
    noisyFindings: cleanSignals(feedback.flatMap((response) => response.noisyFindings ?? [])),
  };
}

function buildGaps(input: {
  prCommentReady: boolean;
  repeatUseReady: boolean;
  mcpReady: boolean;
  healthScore: number;
  validation: DogfoodRepoValidation;
}): string[] {
  const gaps: string[] = [];
  if (input.healthScore < 80) gaps.push('health score below adoption threshold');
  if (!input.mcpReady) gaps.push('MCP setup not ready');
  if (!input.prCommentReady) gaps.push('PR comment is missing required usefulness sections');
  if (!input.repeatUseReady) gaps.push('repeat-use adoption loop is missing');
  if (input.validation.falsePositiveRules.length > 0) {
    gaps.push(
      'reviewer reported false-positive rule(s): ' + input.validation.falsePositiveRules.join(', '),
    );
  }
  if (input.validation.missingSignals.length > 0) {
    gaps.push('reviewer reported missing signal(s): ' + input.validation.missingSignals.join('; '));
  }
  return gaps;
}

function statusFromGaps(gaps: string[], healthScore: number): DogfoodRepoStatus {
  if (healthScore < 70 || gaps.some((gap) => gap.includes('PR comment'))) return 'fail';
  if (gaps.length > 0) return 'warn';
  return 'pass';
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

function buildMarketValidation(
  repos: DogfoodRepoResult[],
  targetRepoCount: number,
): DogfoodMarketValidation {
  const responseCount = repos.reduce((sum, repo) => sum + repo.validation.feedbackResponses, 0);
  const usefulResponses = repos.reduce((sum, repo) => sum + repo.validation.usefulResponses, 0);
  const totalMinutesSaved = repos.reduce((sum, repo) => sum + repo.validation.minutesSaved, 0);
  const preventedBadEdits = repos.reduce((sum, repo) => sum + repo.validation.preventedBadEdits, 0);
  const ownerRoutingClear = repos.reduce((sum, repo) => sum + repo.validation.ownerRoutingClear, 0);
  const nextCommandClear = repos.reduce((sum, repo) => sum + repo.validation.nextCommandClear, 0);
  const falsePositive = {
    totalReports: repos.reduce((sum, repo) => sum + repo.validation.falsePositiveRules.length, 0),
    noisyRules: countSignals(
      repos.flatMap((repo) => repo.validation.falsePositiveRules),
      'rule',
    ),
    missingSignals: countSignals(
      repos.flatMap((repo) => repo.validation.missingSignals),
      'signal',
    ),
    noisyFindings: countSignals(
      repos.flatMap((repo) => repo.validation.noisyFindings),
      'finding',
    ),
  };
  const repoCoverage = {
    target: targetRepoCount,
    evaluated: repos.length,
    targetMet: repos.length >= targetRepoCount,
  };
  const firstPr = {
    readyRepos: repos.filter((repo) => repo.prCommentReady).length,
    repeatUseReadyRepos: repos.filter((repo) => repo.repeatUseReady).length,
    requiredFeedbackQuestions: [...FEEDBACK_QUESTIONS],
  };
  const feedback = {
    responses: responseCount,
    usefulResponses,
    usefulnessRate: responseCount > 0 ? round(usefulResponses / responseCount) : 0,
    preventedBadEdits,
    ownerRoutingClear,
    nextCommandClear,
    minutesSaved: {
      total: totalMinutesSaved,
      average: responseCount > 0 ? round(totalMinutesSaved / responseCount) : 0,
      max: Math.max(0, ...repos.map((repo) => repo.validation.minutesSaved)),
    },
  };
  const repeatUse = summarizeRepeatUse(repos);
  const value = {
    averageMinutesSaved: feedback.minutesSaved.average,
    requiredAverageMinutesSaved: MIN_AVERAGE_MINUTES_SAVED,
    preventedBadEdits,
    ready: feedback.minutesSaved.average >= MIN_AVERAGE_MINUTES_SAVED || preventedBadEdits > 0,
  };
  const status = marketStatus({
    targetMet: repoCoverage.targetMet,
    responses: responseCount,
    usefulResponses,
    falsePositiveReports: falsePositive.totalReports,
    valueReady: value.ready,
    repeatUseReady: repeatUse.ready,
  });
  const summary = summarizeMarketValidation(
    status,
    repoCoverage.evaluated,
    targetRepoCount,
    feedback,
    falsePositive.totalReports,
    value,
    repeatUse,
  );
  const proofGates = buildProofGates(
    repoCoverage,
    feedback,
    value,
    repeatUse,
    falsePositive.totalReports,
  );
  const nextProofStep = nextProofStepFromGates(status, proofGates);
  return {
    status,
    summary,
    proofGates,
    nextProofStep,
    repoCoverage,
    feedback,
    falsePositive,
    firstPr,
    value,
    repeatUse,
    websiteProof: buildWebsiteProof(repos, feedback, falsePositive.totalReports, status, repeatUse),
  };
}

function marketStatus(input: {
  targetMet: boolean;
  responses: number;
  usefulResponses: number;
  falsePositiveReports: number;
  valueReady: boolean;
  repeatUseReady: boolean;
}): DogfoodMarketValidation['status'] {
  if (!input.targetMet) return 'needs_more_repos';
  if (input.responses === 0) return 'needs_feedback';
  if (input.usefulResponses < MIN_USEFUL_REVIEWER_RESPONSES) return 'needs_tuning';
  if (input.falsePositiveReports > input.usefulResponses) return 'needs_tuning';
  if (!input.valueReady) return 'needs_tuning';
  if (!input.repeatUseReady) return 'needs_tuning';
  return 'proven';
}

function buildProofGates(
  repoCoverage: DogfoodMarketValidation['repoCoverage'],
  feedback: DogfoodMarketValidation['feedback'],
  value: DogfoodMarketValidation['value'],
  repeatUse: DogfoodMarketValidation['repeatUse'],
  falsePositiveReports: number,
): DogfoodMarketValidation['proofGates'] {
  const moreRepos = Math.max(0, repoCoverage.target - repoCoverage.evaluated);
  const moreUsefulResponses = Math.max(0, MIN_USEFUL_REVIEWER_RESPONSES - feedback.usefulResponses);
  const moreRepeatedRepos = Math.max(0, repeatUse.requiredRepeatedRepos - repeatUse.repeatedRepos);
  return [
    {
      id: 'repo-coverage',
      status: repoCoverage.targetMet ? 'pass' : 'fail',
      summary: repoCoverage.targetMet
        ? `${repoCoverage.evaluated}/${repoCoverage.target} repo target met.`
        : `Add ${moreRepos} more repo(s) before calling adoption proven.`,
      command: 'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --format json',
    },
    {
      id: 'reviewer-feedback',
      status: feedback.responses > 0 ? 'pass' : 'fail',
      summary:
        feedback.responses > 0
          ? `${feedback.responses} reviewer response(s) captured.`
          : 'Capture structured reviewer feedback from the first real PR.',
      command: FEEDBACK_CAPTURE_COMMAND,
    },
    {
      id: 'useful-feedback',
      status: feedback.usefulResponses >= MIN_USEFUL_REVIEWER_RESPONSES ? 'pass' : 'fail',
      summary:
        feedback.usefulResponses >= MIN_USEFUL_REVIEWER_RESPONSES
          ? `${feedback.usefulResponses} useful reviewer response(s) captured.`
          : `Collect at least ${moreUsefulResponses} more useful reviewer response(s).`,
      command: FEEDBACK_CAPTURE_COMMAND,
    },
    {
      id: 'repeat-use',
      status: repeatUse.ready ? 'pass' : 'fail',
      summary: repeatUse.ready
        ? `${repeatUse.repeatedRepos} repo(s) with repeat PR feedback and ${repeatUse.distinctPrs} distinct PR(s).`
        : `Capture repeat PR feedback in at least ${moreRepeatedRepos} repo(s).`,
      command: DOGFOOD_WITH_FEEDBACK_COMMAND,
    },
    {
      id: 'measured-value',
      status: value.ready ? 'pass' : 'fail',
      summary: value.ready
        ? `Measured value ready: ${value.averageMinutesSaved} average minutes saved or ${value.preventedBadEdits} risky edit(s) prevented.`
        : 'Record 10+ average minutes saved or at least one prevented risky edit.',
      command: FEEDBACK_CAPTURE_COMMAND,
    },
    {
      id: 'false-positive-balance',
      status: falsePositiveReports <= feedback.usefulResponses ? 'pass' : 'fail',
      summary:
        falsePositiveReports <= feedback.usefulResponses
          ? `${falsePositiveReports} false-positive report(s) do not outnumber ${feedback.usefulResponses} useful response(s).`
          : 'Tune false-positive reports until they no longer outnumber useful responses.',
      command: 'projscan memory stable --format json',
    },
  ];
}

function nextProofStepFromGates(
  status: DogfoodMarketValidation['status'],
  proofGates: DogfoodMarketValidation['proofGates'],
): string {
  if (status === 'proven') return 'Adoption proof is ready for public claims.';
  return (
    proofGates.find((gate) => gate.status === 'fail')?.summary ??
    'Review adoption proof gates before expanding rollout.'
  );
}

function summarizeMarketValidation(
  status: DogfoodMarketValidation['status'],
  evaluated: number,
  target: number,
  feedback: DogfoodMarketValidation['feedback'],
  falsePositiveReports: number,
  value: DogfoodMarketValidation['value'],
  repeatUse: DogfoodMarketValidation['repeatUse'],
): string {
  const base =
    evaluated +
    '/' +
    target +
    ' repo target; ' +
    feedback.responses +
    ' reviewer response(s); ' +
    feedback.minutesSaved.total +
    ' minutes saved; avg ' +
    value.averageMinutesSaved +
    '/' +
    value.requiredAverageMinutesSaved +
    ' min target; ' +
    feedback.preventedBadEdits +
    ' risky edit(s) prevented; ' +
    falsePositiveReports +
    ' false-positive report(s); ' +
    repeatUse.repeatedRepos +
    ' repo(s) with repeat PR feedback';
  if (status === 'proven') return 'market validation proven: ' + base;
  if (status === 'needs_more_repos') return 'market validation needs more repos: ' + base;
  if (status === 'needs_feedback') return 'market validation needs reviewer feedback: ' + base;
  return 'market validation needs tuning: ' + base;
}

function buildWebsiteProof(
  repos: DogfoodRepoResult[],
  feedback: DogfoodMarketValidation['feedback'],
  falsePositiveReports: number,
  status: DogfoodMarketValidation['status'],
  repeatUse: DogfoodMarketValidation['repeatUse'],
): DogfoodMarketValidation['websiteProof'] {
  const repoCount = repos.length;
  const headline = buildWebsiteProofHeadline(status, repoCount);
  const metrics = [
    repoCount + ' real repo(s) evaluated',
    feedback.responses + ' reviewer response(s)',
    feedback.minutesSaved.total + ' minutes saved',
    feedback.preventedBadEdits + ' risky edits prevented',
    repeatUse.repeatedRepos + ' repo(s) with repeat PR feedback',
    falsePositiveReports + ' false-positive report(s) tracked',
  ];
  const claimBullet =
    status === 'proven'
      ? 'Website claims can cite measured minutes saved and risky edits prevented instead of generic scanner claims.'
      : 'Website claims should stay provisional until repo coverage, useful feedback, and false-positive tuning are ready.';
  const bullets = [
    'Generated PR comments were validated before posting.',
    'Reviewer feedback is captured as structured dogfood evidence.',
    'Repeat PR use is measured separately from first-PR usefulness.',
    'False positives, missing signals, owner clarity, and next-command clarity are visible in one report.',
    claimBullet,
  ];
  const markdown = [
    '## Market Validation Proof',
    '',
    '**Status:** ' + status,
    '**Headline:** ' + headline,
    '',
    '### Metrics',
    ...metrics.map((metric) => '- ' + metric),
    '',
    '### What To Show On The Website',
    ...bullets.map((bullet) => '- ' + bullet),
  ].join('\\n');
  return { headline, metrics, bullets, markdown };
}

function buildWebsiteProofHeadline(
  status: DogfoodMarketValidation['status'],
  repoCount: number,
): string {
  if (status === 'proven') return 'projscan proved useful across ' + repoCount + ' real repo(s)';
  if (status === 'needs_more_repos')
    return 'projscan needs more real-repo validation before public proof';
  if (status === 'needs_feedback')
    return 'projscan needs reviewer feedback before usefulness proof';
  return 'projscan needs tuning before usefulness proof';
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
): PreflightSuggestedAction[] {
  const actions: PreflightSuggestedAction[] = [
    {
      label: 'Run dogfood against a real team repo',
      command: 'projscan dogfood --repo <path-to-repo> --format json',
    },
    {
      label: 'Initialize structured reviewer feedback',
      command: FEEDBACK_INIT_COMMAND,
    },
    {
      label: 'Capture first PR feedback as structured evidence',
      command: FEEDBACK_CAPTURE_COMMAND,
    },
    {
      label: 'Roll feedback into dogfood validation',
      command: DOGFOOD_WITH_FEEDBACK_COMMAND,
    },
    {
      label: 'Capture first PR feedback',
      command: 'projscan evidence-pack --pr-comment',
    },
  ];
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
      command: FEEDBACK_CAPTURE_COMMAND,
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

function summarizeRepeatUse(repos: DogfoodRepoResult[]): DogfoodMarketValidation['repeatUse'] {
  const distinctPrs = countDistinct(repos.flatMap((repo) => repo.validation.prRefs));
  const repeatedRepos = repos.filter((repo) => countDistinct(repo.validation.prRefs) >= 2).length;
  return {
    distinctPrs,
    repeatedRepos,
    requiredDistinctPrs: MIN_REPEAT_FEEDBACK_PRS,
    requiredRepeatedRepos: MIN_REPEAT_FEEDBACK_REPOS,
    ready: distinctPrs >= MIN_REPEAT_FEEDBACK_PRS && repeatedRepos >= MIN_REPEAT_FEEDBACK_REPOS,
  };
}

function countDistinct(values: string[]): number {
  return new Set(values.map(normalizeMatchValue).filter(Boolean)).size;
}

function countSignals<T extends 'rule' | 'signal' | 'finding'>(
  values: string[],
  key: T,
): Array<Record<T, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const value of cleanSignals(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ [key]: value, count }) as Record<T, string> & { count: number });
}

function cleanSignals(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.toLowerCase() !== 'none');
}

function sumNumbers(values: Array<number | undefined>): number {
  return values.reduce<number>((sum, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return sum;
    return sum + value;
  }, 0);
}

function normalizeMatchValue(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/$/, '').trim().toLowerCase();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
