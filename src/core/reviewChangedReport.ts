import { diffGraphs } from './prDiff.js';
import { buildReviewBaseSnapshot } from './reviewBaseSnapshot.js';
import { buildReviewHeadSnapshot } from './reviewHeadSnapshot.js';
import { buildReviewFindings } from './reviewFindings.js';
import { applyReviewIntent } from './reviewIntent.js';
import { readManifests } from './reviewManifests.js';
import { unavailableReviewReport, type ReviewState } from './reviewState.js';
import type { ReviewReport } from '../types/review.js';

interface ChangedReviewOptions {
  base?: string;
  head?: string;
  intent?: string;
  package?: string;
}

type ReadyReviewState = Extract<ReviewState, { kind: 'ready' }>;

export async function buildChangedReviewReport(
  rootPath: string,
  options: ChangedReviewOptions,
  state: ReadyReviewState,
): Promise<ReviewReport> {
  const { baseRef, baseSha, headRef, headSha } = state;
  const { graph: headGraph, hotspots: headHotspots } = await buildReviewHeadSnapshot(rootPath);

  const baseSnapshot = await buildReviewBaseSnapshot(rootPath, baseRef, baseSha);
  if (!baseSnapshot.available) {
    return unavailableReviewReport(baseSnapshot.reason, options, baseRef, headRef, headSha, baseSha);
  }

  const baseGraph = baseSnapshot.graph;
  const headPackageManifests = await readManifests(rootPath);
  const prDiff = diffGraphs(baseRef, baseSha, headRef, headSha, baseGraph, headGraph);
  const findings = await buildReviewFindings({
    rootPath,
    packageName: options.package,
    prDiff,
    baseGraph,
    headGraph,
    headHotspots,
    basePackageManifests: baseSnapshot.packageManifests,
    headPackageManifests,
  });

  const report: ReviewReport = {
    available: true,
    base: { ref: baseRef, resolvedSha: baseSha },
    head: { ref: headRef, resolvedSha: headSha },
    prDiff,
    ...findings,
  };

  applyReviewIntent(report, options.intent);
  return report;
}
