import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const abs = path.join(root, rel);
  const stat = await fs.stat(abs);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

describe('review architecture guards', () => {
  it('keeps risky-function matching isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    expect(review.functions?.some((fn) => fn.name === 'findRiskyFunctions')).toBe(false);

    const matcherModule = await inspectRepoSourceFile('src/core/reviewRiskyFunctions.ts');
    const matcher = matcherModule.functions?.find((fn) => fn.name === 'findRiskyFunctions');

    expect(matcher).toBeDefined();
    expect(matcher!.cyclomaticComplexity).toBeLessThanOrEqual(12);
  });

  it('keeps verdict assembly isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    expect(review.functions?.some((fn) => fn.name === 'decideVerdict')).toBe(false);

    const verdictModule = await inspectRepoSourceFile('src/core/reviewVerdict.ts');
    const decide = verdictModule.functions?.find((fn) => fn.name === 'decideVerdict');

    expect(decide).toBeDefined();
    expect(decide!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps package manifest diffing isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const manifestFunctions = new Set([
      'readManifests',
      'readOneManifest',
      'readEntrypoints',
      'diffManifests',
      'diffOneManifest',
    ]);
    expect(review.functions?.some((fn) => manifestFunctions.has(fn.name))).toBe(false);

    const manifestModule = await inspectRepoSourceFile('src/core/reviewManifests.ts');
    const readManifests = manifestModule.functions?.find((fn) => fn.name === 'readManifests');
    const diffManifests = manifestModule.functions?.find((fn) => fn.name === 'diffManifests');
    const diffOneManifest = manifestModule.functions?.find((fn) => fn.name === 'diffOneManifest');

    expect(readManifests).toBeDefined();
    expect(readManifests!.cyclomaticComplexity).toBeLessThanOrEqual(7);
    expect(diffManifests).toBeDefined();
    expect(diffManifests!.cyclomaticComplexity).toBeLessThanOrEqual(7);
    expect(diffOneManifest).toBeDefined();
    expect(diffOneManifest!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps public contract change detection isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const contractFunctions = new Set([
      'buildContractChanges',
      'scopeManifestsByPackage',
      'exportContractChange',
      'entrypointContractChanges',
    ]);
    expect(review.functions?.some((fn) => contractFunctions.has(fn.name))).toBe(false);

    const contractModule = await inspectRepoSourceFile('src/core/reviewContractChanges.ts');
    const buildContractChanges = contractModule.functions?.find(
      (fn) => fn.name === 'buildContractChanges',
    );
    const entrypointContractChanges = contractModule.functions?.find(
      (fn) => fn.name === 'entrypointContractChanges',
    );

    expect(buildContractChanges).toBeDefined();
    expect(buildContractChanges!.cyclomaticComplexity).toBeLessThanOrEqual(8);
    expect(entrypointContractChanges).toBeDefined();
    expect(entrypointContractChanges!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps changed-file assembly isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const changedFileFunctions = new Set([
      'indexHotspotRisk',
      'buildReviewChangedFiles',
      'appendAddedReviewFiles',
      'appendRemovedReviewFiles',
      'appendModifiedReviewFiles',
    ]);
    expect(review.functions?.some((fn) => changedFileFunctions.has(fn.name))).toBe(false);

    const changedFileModule = await inspectRepoSourceFile('src/core/reviewChangedFiles.ts');
    const buildReviewChangedFiles = changedFileModule.functions?.find(
      (fn) => fn.name === 'buildReviewChangedFiles',
    );
    const indexHotspotRisk = changedFileModule.functions?.find(
      (fn) => fn.name === 'indexHotspotRisk',
    );

    expect(buildReviewChangedFiles).toBeDefined();
    expect(buildReviewChangedFiles!.cyclomaticComplexity).toBeLessThanOrEqual(4);
    expect(indexHotspotRisk).toBeDefined();
    expect(indexHotspotRisk!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps graph evidence assembly isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const graphEvidenceFunctions = new Set([
      'buildReviewGraphEvidence',
      'scopeGraphToFiles',
      'filterImporterMap',
      'topPackages',
    ]);
    expect(review.functions?.some((fn) => graphEvidenceFunctions.has(fn.name))).toBe(false);

    const graphEvidenceModule = await inspectRepoSourceFile('src/core/reviewGraphEvidence.ts');
    const buildReviewGraphEvidence = graphEvidenceModule.functions?.find(
      (fn) => fn.name === 'buildReviewGraphEvidence',
    );
    const scopeGraphToFiles = graphEvidenceModule.functions?.find(
      (fn) => fn.name === 'scopeGraphToFiles',
    );

    expect(buildReviewGraphEvidence).toBeDefined();
    expect(buildReviewGraphEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(4);
    expect(scopeGraphToFiles).toBeDefined();
    expect(scopeGraphToFiles!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps taint and dataflow diffing isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const flowFunctions = new Set([
      'computeNewTaintFlows',
      'reviewTaintFlowKey',
      'computeNewDataflowRisks',
      'reviewDataflowRiskKey',
    ]);
    expect(review.functions?.some((fn) => flowFunctions.has(fn.name))).toBe(false);

    const flowModule = await inspectRepoSourceFile('src/core/reviewFlowDiffs.ts');
    const computeNewTaintFlows = flowModule.functions?.find(
      (fn) => fn.name === 'computeNewTaintFlows',
    );
    const computeNewDataflowRisks = flowModule.functions?.find(
      (fn) => fn.name === 'computeNewDataflowRisks',
    );

    expect(computeNewTaintFlows).toBeDefined();
    expect(computeNewTaintFlows!.cyclomaticComplexity).toBeLessThanOrEqual(8);
    expect(computeNewDataflowRisks).toBeDefined();
    expect(computeNewDataflowRisks!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps review finding assembly isolated from the review orchestrator', async () => {
    const reviewSource = await fs.readFile(path.join(process.cwd(), 'src/core/review.ts'), 'utf-8');
    expect(reviewSource).not.toContain('const touchedFiles = new Set<string>');
    expect(reviewSource).not.toContain('computeNewTaintFlows(');
    expect(reviewSource).not.toContain('decideVerdict(');

    const findings = await inspectRepoSourceFile('src/core/reviewFindings.ts');
    const buildFindings = findings.functions?.find((fn) => fn.name === 'buildReviewFindings');
    const touchedFiles = findings.functions?.find((fn) => fn.name === 'reviewTouchedFiles');

    expect(buildFindings).toBeDefined();
    expect(buildFindings!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(touchedFiles).toBeDefined();
    expect(touchedFiles!.cyclomaticComplexity).toBeLessThanOrEqual(1);
  });

  it('keeps tier shaping isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const tierFunctions = new Set(['selectReviewTier', 'shapeReviewForTier']);
    expect(review.functions?.some((fn) => tierFunctions.has(fn.name))).toBe(false);

    const tierModule = await inspectRepoSourceFile('src/core/reviewTier.ts');
    const selectReviewTier = tierModule.functions?.find((fn) => fn.name === 'selectReviewTier');
    const shapeReviewForTier = tierModule.functions?.find(
      (fn) => fn.name === 'shapeReviewForTier',
    );

    expect(selectReviewTier).toBeDefined();
    expect(selectReviewTier!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(shapeReviewForTier).toBeDefined();
    expect(shapeReviewForTier!.cyclomaticComplexity).toBeLessThanOrEqual(10);
  });

  it('keeps cycle classification isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const cycleFunctions = new Set(['classifyNewCycles', 'scopeCyclesToFiles']);
    expect(review.functions?.some((fn) => cycleFunctions.has(fn.name))).toBe(false);

    const cycleModule = await inspectRepoSourceFile('src/core/reviewCycles.ts');
    const classifyNewCycles = cycleModule.functions?.find((fn) => fn.name === 'classifyNewCycles');
    const scopeCyclesToFiles = cycleModule.functions?.find((fn) => fn.name === 'scopeCyclesToFiles');

    expect(classifyNewCycles).toBeDefined();
    expect(classifyNewCycles!.cyclomaticComplexity).toBeLessThanOrEqual(8);
    expect(scopeCyclesToFiles).toBeDefined();
    expect(scopeCyclesToFiles!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps no-change report assembly isolated from the review orchestrator', async () => {
    const reviewSource = await fs.readFile(path.join(process.cwd(), 'src/core/review.ts'), 'utf-8');
    expect(reviewSource).not.toContain('No structural changes detected between base and head.');

    const noChangesModule = await inspectRepoSourceFile('src/core/reviewNoChanges.ts');
    const buildNoChangeReport = noChangesModule.functions?.find(
      (fn) => fn.name === 'buildNoChangeReviewReport',
    );

    expect(buildNoChangeReport).toBeDefined();
    expect(buildNoChangeReport!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps intent annotation isolated from the review orchestrator', async () => {
    const reviewSource = await fs.readFile(path.join(process.cwd(), 'src/core/review.ts'), 'utf-8');
    expect(reviewSource).toContain("from './reviewIntent.js'");
    expect(reviewSource).not.toContain("from './intent.js'");
    expect(reviewSource).not.toContain('function applyIntent');
    expect(reviewSource).not.toContain('annotateReviewWithIntent');

    const intentModule = await inspectRepoSourceFile('src/core/reviewIntent.ts');
    const applyReviewIntent = intentModule.functions?.find(
      (fn) => fn.name === 'applyReviewIntent',
    );

    expect(applyReviewIntent).toBeDefined();
    expect(applyReviewIntent!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps head-side scan and hotspot assembly isolated from the review orchestrator', async () => {
    const reviewSource = await fs.readFile(path.join(process.cwd(), 'src/core/review.ts'), 'utf-8');
    expect(reviewSource).not.toContain('collectIssues');
    expect(reviewSource).not.toContain('analyzeHotspots');

    const headModule = await inspectRepoSourceFile('src/core/reviewHeadSnapshot.ts');
    const buildHeadSnapshot = headModule.functions?.find(
      (fn) => fn.name === 'buildReviewHeadSnapshot',
    );

    expect(buildHeadSnapshot).toBeDefined();
    expect(buildHeadSnapshot!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  });

  it('keeps base worktree snapshot assembly isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const reviewFunctions = new Set(review.functions?.map((fn) => fn.name));
    expect(reviewFunctions.has('mkTempWorktreeDir')).toBe(false);
    expect(reviewFunctions.has('gitFailureSummary')).toBe(false);

    const baseModule = await inspectRepoSourceFile('src/core/reviewBaseSnapshot.ts');
    const buildBaseSnapshot = baseModule.functions?.find(
      (fn) => fn.name === 'buildReviewBaseSnapshot',
    );
    const mkTempWorktreeDir = baseModule.functions?.find(
      (fn) => fn.name === 'mkTempWorktreeDir',
    );

    expect(buildBaseSnapshot).toBeDefined();
    expect(buildBaseSnapshot!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(mkTempWorktreeDir).toBeDefined();
    expect(mkTempWorktreeDir!.cyclomaticComplexity).toBeLessThanOrEqual(1);
  });

  it('keeps package scope filtering isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const reviewFunctions = new Set(review.functions?.map((fn) => fn.name));
    expect(reviewFunctions.has('resolvePackageScopeFiles')).toBe(false);
    expect(reviewFunctions.has('scopePrDiffToPackage')).toBe(false);

    const packageScope = await inspectRepoSourceFile('src/core/reviewPackageScope.ts');
    const resolvePackageScopeFiles = packageScope.functions?.find(
      (fn) => fn.name === 'resolvePackageScopeFiles',
    );
    const scopePrDiffToPackage = packageScope.functions?.find(
      (fn) => fn.name === 'scopePrDiffToPackage',
    );

    expect(resolvePackageScopeFiles).toBeDefined();
    expect(resolvePackageScopeFiles!.cyclomaticComplexity).toBeLessThanOrEqual(2);
    expect(scopePrDiffToPackage).toBeDefined();
    expect(scopePrDiffToPackage!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps git ref and worktree state checks isolated from the review orchestrator', async () => {
    const review = await inspectRepoSourceFile('src/core/review.ts');
    const reviewFunctions = new Set(review.functions?.map((fn) => fn.name));
    expect(reviewFunctions.has('isGitRepository')).toBe(false);
    expect(reviewFunctions.has('isWorktreeClean')).toBe(false);
    expect(reviewFunctions.has('resolveSha')).toBe(false);
    expect(reviewFunctions.has('pickDefaultBase')).toBe(false);

    const refs = await inspectRepoSourceFile('src/core/reviewRefs.ts');
    const isGitRepository = refs.functions?.find((fn) => fn.name === 'isGitRepository');
    const isWorktreeClean = refs.functions?.find((fn) => fn.name === 'isWorktreeClean');
    const resolveSha = refs.functions?.find((fn) => fn.name === 'resolveSha');
    const pickDefaultBase = refs.functions?.find((fn) => fn.name === 'pickDefaultBase');

    expect(isGitRepository).toBeDefined();
    expect(isGitRepository!.cyclomaticComplexity).toBeLessThanOrEqual(2);
    expect(isWorktreeClean).toBeDefined();
    expect(isWorktreeClean!.cyclomaticComplexity).toBeLessThanOrEqual(4);
    expect(resolveSha).toBeDefined();
    expect(resolveSha!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(pickDefaultBase).toBeDefined();
    expect(pickDefaultBase!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  });

  it('keeps review state resolution isolated from the review orchestrator', async () => {
    const reviewSource = await fs.readFile(path.join(process.cwd(), 'src/core/review.ts'), 'utf-8');
    expect(reviewSource).not.toContain('Not a git repository - PR review requires git history.');
    expect(reviewSource).not.toContain('Could not resolve base ref');
    expect(reviewSource).not.toContain('buildNoChangeReviewReport');
    expect(reviewSource).not.toContain('function unavailable');

    const state = await inspectRepoSourceFile('src/core/reviewState.ts');
    const resolveState = state.functions?.find((fn) => fn.name === 'resolveReviewState');
    const unavailableReport = state.functions?.find(
      (fn) => fn.name === 'unavailableReviewReport',
    );

    expect(resolveState).toBeDefined();
    expect(resolveState!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(unavailableReport).toBeDefined();
    expect(unavailableReport!.cyclomaticComplexity).toBeLessThanOrEqual(1);
  });

});
