import path from 'node:path';

import {
  DOGFOOD_WITH_FEEDBACK_COMMAND,
  FEEDBACK_QUESTIONS,
} from './dogfoodMarketValidation.js';
import { computeEvidencePack } from './releaseEvidence.js';
import { computeStartReport } from './start.js';
import type {
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  DogfoodRepoResult,
  DogfoodRepoStatus,
  DogfoodRepoValidation,
} from '../types/dogfood.js';

export const FEEDBACK_INIT_COMMAND = 'projscan feedback init --output .projscan-feedback.json';

export function normalizeDogfoodFeedback(
  input: DogfoodFeedbackInput | undefined,
): DogfoodFeedbackResponse[] {
  return Array.isArray(input?.responses) ? input.responses : [];
}

export async function evaluateDogfoodRepo(
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
  const feedbackCaptureCommand = feedbackCaptureCommandForRepo(name);
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
    feedbackCaptureCommand,
    nextCommands: [
      'projscan init team --team platform',
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      FEEDBACK_INIT_COMMAND,
      feedbackCaptureCommand,
      DOGFOOD_WITH_FEEDBACK_COMMAND,
    ],
  };
}

function feedbackCaptureCommandForRepo(repoName: string): string {
  return (
    'projscan feedback add --file .projscan-feedback.json --repo ' +
    shellQuote(repoName) +
    ' --pr <url> --reviewer <handle> --useful true --minutes-saved 10'
  );
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return "'" + value.replace(/'/g, "'\\''") + "'";
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
