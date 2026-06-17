import { computeCoupling } from './couplingAnalyzer.js';
import { findRiskyFunctions } from './reviewRiskyFunctions.js';
import { decideVerdict } from './reviewVerdict.js';
import { buildContractChanges } from './reviewContractChanges.js';
import { buildReviewChangedFiles, indexHotspotRisk } from './reviewChangedFiles.js';
import { classifyNewCycles, scopeCyclesToFiles } from './reviewCycles.js';
import { buildReviewGraphEvidence } from './reviewGraphEvidence.js';
import { computeNewDataflowRisks, computeNewTaintFlows } from './reviewFlowDiffs.js';
import { resolvePackageScopeFiles, scopePrDiffToPackage } from './reviewPackageScope.js';
import { diffManifests, scopeDependencyChanges, type ManifestSnapshot } from './reviewManifests.js';
import type { CodeGraph } from './codeGraph.js';
import type { HotspotReport } from '../types.js';
import type { PrDiffReport } from '../types/prDiff.js';
import type { ReviewReport } from '../types/review.js';

type ReviewFindings = Pick<
  ReviewReport,
  | 'changedFiles'
  | 'newCycles'
  | 'riskyFunctions'
  | 'dependencyChanges'
  | 'contractChanges'
  | 'newTaintFlows'
  | 'newDataflowRisks'
  | 'graphEvidence'
  | 'verdict'
  | 'summary'
>;

export async function buildReviewFindings(input: {
  rootPath: string;
  packageName?: string;
  prDiff: PrDiffReport;
  baseGraph: CodeGraph;
  headGraph: CodeGraph;
  headHotspots: HotspotReport;
  basePackageManifests: Map<string, ManifestSnapshot>;
  headPackageManifests: Map<string, ManifestSnapshot>;
}): Promise<ReviewFindings> {
  await scopePrDiffToPackage(input.rootPath, input.prDiff, input.packageName);
  const graphScopeFiles = await resolvePackageScopeFiles(
    input.rootPath,
    input.headGraph,
    input.packageName,
  );
  const changedFiles = buildReviewChangedFiles(
    input.prDiff,
    input.baseGraph,
    input.headGraph,
    indexHotspotRisk(input.headHotspots.hotspots),
  );
  const newCycles = reviewNewCycles(input.baseGraph, input.headGraph, input.prDiff, graphScopeFiles);
  const riskyFunctions = findRiskyFunctions(input.baseGraph, input.headGraph, input.prDiff);
  const dependencyChanges = scopeDependencyChanges(
    diffManifests(input.basePackageManifests, input.headPackageManifests),
    input.packageName,
  );
  const contractChanges = buildContractChanges(
    input.prDiff,
    input.baseGraph,
    input.headGraph,
    input.basePackageManifests,
    input.headPackageManifests,
    input.packageName,
  );
  const touchedFiles = reviewTouchedFiles(input.prDiff);
  const newTaintFlows = await computeNewTaintFlows(
    input.rootPath,
    input.baseGraph,
    input.headGraph,
    touchedFiles,
  );
  const newDataflowRisks = await computeNewDataflowRisks(
    input.rootPath,
    input.baseGraph,
    input.headGraph,
    touchedFiles,
  );
  const graphEvidence = buildReviewGraphEvidence(
    input.headGraph,
    touchedFiles,
    newDataflowRisks.length,
    graphScopeFiles,
  );
  const { verdict, summary } = decideVerdict(
    changedFiles,
    newCycles,
    riskyFunctions,
    dependencyChanges,
    contractChanges,
    newTaintFlows,
    newDataflowRisks,
  );

  return {
    changedFiles,
    newCycles,
    riskyFunctions,
    dependencyChanges,
    contractChanges,
    newTaintFlows,
    newDataflowRisks,
    graphEvidence,
    verdict,
    summary,
  };
}

function reviewNewCycles(
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  prDiff: PrDiffReport,
  graphScopeFiles: Set<string> | undefined,
): ReviewReport['newCycles'] {
  const headCoupling = computeCoupling(headGraph);
  const baseCoupling = computeCoupling(baseGraph);
  return scopeCyclesToFiles(
    classifyNewCycles(baseCoupling.cycles, headCoupling.cycles, prDiff.filesAdded),
    graphScopeFiles,
  );
}

function reviewTouchedFiles(prDiff: PrDiffReport): Set<string> {
  return new Set([
    ...prDiff.filesAdded,
    ...prDiff.filesRemoved,
    ...prDiff.filesModified.map((file) => file.relativePath),
  ]);
}
