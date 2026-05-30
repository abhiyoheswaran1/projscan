import path from 'node:path';

import { computeEvidencePack } from './releaseEvidence.js';
import { computeStartReport } from './start.js';
import type {
  DogfoodReport,
  DogfoodRepoResult,
  DogfoodRepoStatus,
  PreflightSuggestedAction,
} from '../types.js';

export interface ComputeDogfoodOptions {
  repos?: string[];
  targetRepoCount?: number;
}

const DEFAULT_TARGET_REPO_COUNT = 3;
const FEEDBACK_QUESTIONS = [
  'Did the PR comment save 10-20 minutes?',
  'What was missing or noisy?',
  'Which owner or command should have been clearer?',
] as const;

export async function computeDogfoodReport(
  rootPath: string,
  options: ComputeDogfoodOptions = {},
): Promise<DogfoodReport> {
  const targetRepoCount = normalizeTargetRepoCount(options.targetRepoCount);
  const repos = normalizeRepos(rootPath, options.repos);
  const results = await Promise.all(repos.map((repoPath) => evaluateRepo(repoPath)));
  const totals = summarizeTotals(results);
  return {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    targetRepoCount,
    summary: summarizeDogfood(results.length, targetRepoCount, totals),
    repos: results,
    totals,
    suggestedNextActions: buildDogfoodActions(results.length, targetRepoCount),
  };
}

async function evaluateRepo(repoPath: string): Promise<DogfoodRepoResult> {
  const [start, evidence] = await Promise.all([
    computeStartReport(repoPath, { mode: 'before_merge', maxTasks: 4, maxRisks: 5 }),
    computeEvidencePack(repoPath, { includePrComment: true, maxFindings: 3 }),
  ]);
  const prComment = evidence.prComment ?? '';
  const prCommentReady = evidence.prCommentValidation?.status === 'pass' && prComment.includes('### Developer Feedback');
  const repeatUseReady = start.adoptionLoop?.cadence === 'every_pr' && (start.adoptionLoop.nextCommands.length ?? 0) >= 3;
  const mcpReady = start.evidence.mcpReady;
  const gaps = buildGaps({ prCommentReady, repeatUseReady, mcpReady, healthScore: start.evidence.healthScore });
  return {
    path: repoPath,
    name: path.basename(repoPath) || repoPath,
    status: statusFromGaps(gaps, start.evidence.healthScore),
    healthScore: start.evidence.healthScore,
    mcpReady,
    prCommentReady,
    repeatUseReady,
    verdict: evidence.verdict,
    gaps,
    feedbackQuestions: [...FEEDBACK_QUESTIONS],
    nextCommands: [
      'projscan init team --team platform',
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
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

function buildGaps(input: {
  prCommentReady: boolean;
  repeatUseReady: boolean;
  mcpReady: boolean;
  healthScore: number;
}): string[] {
  const gaps: string[] = [];
  if (input.healthScore < 80) gaps.push('health score below adoption threshold');
  if (!input.mcpReady) gaps.push('MCP setup not ready');
  if (!input.prCommentReady) gaps.push('PR comment is missing required usefulness sections');
  if (!input.repeatUseReady) gaps.push('repeat-use adoption loop is missing');
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
  };
}

function summarizeDogfood(
  reposEvaluated: number,
  targetRepoCount: number,
  totals: DogfoodReport['totals'],
): string {
  const target = reposEvaluated >= targetRepoCount ? 'target met' : 'needs more repos';
  return 'dogfood: ' + reposEvaluated + ' repo(s) evaluated (' + target + '); ' + totals.prCommentReady + '/' + reposEvaluated + ' PR comments ready; ' + totals.repeatUseReady + '/' + reposEvaluated + ' repeat-use loops ready';
}

function buildDogfoodActions(reposEvaluated: number, targetRepoCount: number): PreflightSuggestedAction[] {
  const actions: PreflightSuggestedAction[] = [
    {
      label: 'Run dogfood against a real team repo',
      command: 'projscan dogfood --repo <path-to-repo> --format json',
    },
    {
      label: 'Capture first PR feedback',
      command: 'projscan evidence-pack --pr-comment',
    },
  ];
  if (reposEvaluated < targetRepoCount) {
    actions.unshift({
      label: 'Add ' + (targetRepoCount - reposEvaluated) + ' more repo(s) before calling adoption proven',
      command: 'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --format json',
    });
  }
  return actions;
}
