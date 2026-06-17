import { buildNoChangeReviewReport } from './reviewNoChanges.js';
import { isGitRepository, isWorktreeClean, pickDefaultBase, resolveSha } from './reviewRefs.js';
import type { ReviewReport } from '../types/review.js';

interface ReviewStateOptions {
  base?: string;
  head?: string;
}

interface ReviewRefs {
  baseRef: string;
  baseSha: string | null;
  headRef: string;
  headSha: string | null;
}

export type ReviewState =
  | { kind: 'unavailable'; report: ReviewReport }
  | { kind: 'no-change'; report: ReviewReport }
  | {
      kind: 'ready';
      baseRef: string;
      baseSha: string;
      headRef: string;
      headSha: string;
    };

export async function resolveReviewState(
  rootPath: string,
  options: ReviewStateOptions = {},
): Promise<ReviewState> {
  const unavailable = await repositoryUnavailableState(rootPath, options);
  if (unavailable) return unavailable;

  const refs = await resolveReviewRefs(rootPath, options);
  const ready = requireResolvedRefs(refs, options);
  if (ready.kind !== 'ready') return ready;

  const noChange = await noChangeReviewState(rootPath, ready);
  if (noChange) return noChange;

  return ready;
}

async function repositoryUnavailableState(
  rootPath: string,
  options: ReviewStateOptions,
): Promise<ReviewState | undefined> {
  if (await isGitRepository(rootPath)) return undefined;
  return {
    kind: 'unavailable',
    report: unavailableReviewReport('Not a git repository - PR review requires git history.', options),
  };
}

async function resolveReviewRefs(
  rootPath: string,
  options: ReviewStateOptions,
): Promise<ReviewRefs> {
  const headRef = options.head ?? 'HEAD';
  const baseRef = options.base ?? (await pickDefaultBase(rootPath));
  return {
    headRef,
    baseRef,
    headSha: await resolveSha(rootPath, headRef),
    baseSha: await resolveSha(rootPath, baseRef),
  };
}

function requireResolvedRefs(
  refs: ReviewRefs,
  options: ReviewStateOptions,
): Extract<ReviewState, { kind: 'ready' | 'unavailable' }> {
  if (!refs.baseSha) {
    return {
      kind: 'unavailable',
      report: unavailableReviewReport(
        `Could not resolve base ref "${refs.baseRef}".`,
        options,
        refs.baseRef,
        refs.headRef,
        refs.headSha,
      ),
    };
  }
  if (!refs.headSha) {
    return {
      kind: 'unavailable',
      report: unavailableReviewReport(
        `Could not resolve head ref "${refs.headRef}".`,
        options,
        refs.baseRef,
        refs.headRef,
        null,
        refs.baseSha,
      ),
    };
  }
  return {
    kind: 'ready',
    baseRef: refs.baseRef,
    baseSha: refs.baseSha,
    headRef: refs.headRef,
    headSha: refs.headSha,
  };
}

async function noChangeReviewState(
  rootPath: string,
  refs: Extract<ReviewState, { kind: 'ready' }>,
): Promise<ReviewState | undefined> {
  if (refs.headSha !== refs.baseSha) return undefined;
  if (!(await isWorktreeClean(rootPath))) return undefined;
  return {
    kind: 'no-change',
    report: buildNoChangeReviewReport({
      baseRef: refs.baseRef,
      baseSha: refs.baseSha,
      headRef: refs.headRef,
      headSha: refs.headSha,
    }),
  };
}

export function unavailableReviewReport(
  reason: string,
  options: ReviewStateOptions,
  baseRef = options.base ?? '',
  headRef = options.head ?? 'HEAD',
  headSha: string | null = null,
  baseSha: string | null = null,
): ReviewReport {
  return {
    available: false,
    reason,
    base: { ref: baseRef, resolvedSha: baseSha },
    head: { ref: headRef, resolvedSha: headSha },
    prDiff: {
      available: false,
      reason,
      base: { ref: baseRef, resolvedSha: baseSha },
      head: { ref: headRef, resolvedSha: headSha },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    },
    changedFiles: [],
    newCycles: [],
    riskyFunctions: [],
    dependencyChanges: [],
    newTaintFlows: [],
    newDataflowRisks: [],
    verdict: 'ok',
    summary: [reason],
  };
}
