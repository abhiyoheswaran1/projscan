import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry } from '../../src/types.js';

test('preflight keeps report assembly isolated from the public preflight facade', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).toContain("from './preflightReport.js'");
  expect(preflightSource).not.toContain('buildReleaseScaleEvidence(');
  expect(preflightSource).not.toContain('buildPreflightReasons(');
  expect(preflightSource).not.toContain('buildEvidence(');
  expect(preflightSource).not.toContain('buildRequiredChecks(');
  expect(preflightSource).not.toContain('buildSuggestedActions(');
  expect(preflightSource).not.toContain('buildToolCalls(');
  expect(preflightSource).not.toContain('summarizePreflight(report)');

  const reportSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflightReport.ts'),
    'utf-8',
  );
  expect(reportSource).toContain("from './preflightEvidence.js'");
  expect(reportSource).toContain("from './preflightReasons.js'");
  expect(reportSource).toContain("from './preflightReleaseScale.js'");
  expect(reportSource).toContain("from './preflightVerdict.js'");
  expect(reportSource).not.toContain("from './preflight.js'");

  const report = await inspectRepoSourceFile('src/core/preflightReport.ts');
  const build = report.functions?.find((fn) => fn.name === 'buildPreflightReport');
  expect(build).toBeDefined();
  expect(build!.cyclomaticComplexity).toBeLessThanOrEqual(4);
});

test('preflight keeps policy issue reason formatting isolated from the reason orchestrator', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('Supply-chain gate blocks');
  expect(preflightSource).not.toContain('Plugin policy blocks');

  const issueReasons = await inspectRepoSourceFile('src/core/preflightIssueReasons.ts');
  const policyIssueReasons = issueReasons.functions?.find((fn) => fn.name === 'policyIssueReasons');
  const supplyChainIssueReason = issueReasons.functions?.find(
    (fn) => fn.name === 'supplyChainIssueReason',
  );
  const pluginIssueReason = issueReasons.functions?.find((fn) => fn.name === 'pluginIssueReason');

  expect(policyIssueReasons).toBeDefined();
  expect(policyIssueReasons!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(supplyChainIssueReason).toBeDefined();
  expect(supplyChainIssueReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(pluginIssueReason).toBeDefined();
  expect(pluginIssueReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('preflight keeps changed-file reason formatting isolated from the reason orchestrator', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('Health error on changed file');
  expect(preflightSource).not.toContain('Health warning on changed file');
  expect(preflightSource).not.toContain('Changed files unavailable');
  const reasonSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflightReasons.ts'),
    'utf-8',
  );
  expect(reasonSource).toContain('changedFileReasons(input)');

  const changedFileReasons = await inspectRepoSourceFile('src/core/preflightChangedFileReasons.ts');
  const entrypoint = changedFileReasons.functions?.find((fn) => fn.name === 'changedFileReasons');
  const issueReason = changedFileReasons.functions?.find((fn) => fn.name === 'changedIssueReason');
  const availabilityReason = changedFileReasons.functions?.find(
    (fn) => fn.name === 'changedFilesAvailabilityReason',
  );
  const thresholdReason = changedFileReasons.functions?.find(
    (fn) => fn.name === 'changedFilesThresholdReason',
  );

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(issueReason).toBeDefined();
  expect(issueReason!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(availabilityReason).toBeDefined();
  expect(availabilityReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(thresholdReason).toBeDefined();
  expect(thresholdReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('preflight keeps required check formatting isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('function buildRequiredChecks');
  expect(preflightSource).not.toContain('function formatReviewCheckReason');

  const requiredChecks = await inspectRepoSourceFile('src/core/preflightRequiredChecks.ts');
  const entrypoint = requiredChecks.functions?.find((fn) => fn.name === 'buildRequiredChecks');
  const healthCheck = requiredChecks.functions?.find((fn) => fn.name === 'healthRequiredCheck');
  const supplyChainCheck = requiredChecks.functions?.find(
    (fn) => fn.name === 'supplyChainRequiredCheck',
  );
  const reviewStatus = requiredChecks.functions?.find((fn) => fn.name === 'reviewCheckStatus');
  const reviewReason = requiredChecks.functions?.find(
    (fn) => fn.name === 'formatReviewCheckReason',
  );

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(healthCheck).toBeDefined();
  expect(healthCheck!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(supplyChainCheck).toBeDefined();
  expect(supplyChainCheck!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(reviewStatus).toBeDefined();
  expect(reviewStatus!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  expect(reviewReason).toBeDefined();
  expect(reviewReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('preflight keeps release-scale evidence isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('function buildReleaseScaleEvidence');
  expect(preflightSource).not.toContain('function concretePreflightBlockers');

  const releaseScale = await inspectRepoSourceFile('src/core/preflightReleaseScale.ts');
  const entrypoint = releaseScale.functions?.find((fn) => fn.name === 'buildReleaseScaleEvidence');
  const signals = releaseScale.functions?.find((fn) => fn.name === 'releaseScaleSignals');
  const explanation = releaseScale.functions?.find((fn) => fn.name === 'releaseScaleExplanation');
  const blockers = releaseScale.functions?.find((fn) => fn.name === 'concretePreflightBlockers');

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  expect(signals).toBeDefined();
  expect(signals!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(explanation).toBeDefined();
  expect(explanation!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(blockers).toBeDefined();
  expect(blockers!.cyclomaticComplexity).toBeLessThanOrEqual(8);
});

test('preflight keeps reason assembly isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  const reportSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflightReport.ts'),
    'utf-8',
  );
  expect(reportSource).toContain("from './preflightReasons.js'");
  expect(preflightSource).not.toContain("from './preflightReasons.js'");
  expect(preflightSource).not.toContain('function buildPreflightReasons');
  expect(preflightSource).not.toContain('function countSupplyChainIssues');

  const reasonSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflightReasons.ts'),
    'utf-8',
  );
  expect(reasonSource).not.toContain("from './preflight.js'");

  const reasons = await inspectRepoSourceFile('src/core/preflightReasons.ts');
  const buildPreflightReasons = reasons.functions?.find(
    (fn) => fn.name === 'buildPreflightReasons',
  );
  const countSupplyChainIssues = reasons.functions?.find(
    (fn) => fn.name === 'countSupplyChainIssues',
  );

  expect(buildPreflightReasons).toBeDefined();
  expect(buildPreflightReasons!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(countSupplyChainIssues).toBeDefined();
  expect(countSupplyChainIssues!.cyclomaticComplexity).toBeLessThanOrEqual(2);
});

test('preflight keeps review reason formatting isolated from the reason orchestrator', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('Review verdict is block');
  expect(preflightSource).not.toContain('new taint flow(s) found in review');
  expect(preflightSource).not.toContain('Review unavailable');

  const reviewReasons = await inspectRepoSourceFile('src/core/preflightReviewReasons.ts');
  const entrypoint = reviewReasons.functions?.find((fn) => fn.name === 'reviewReasons');
  const verdictReason = reviewReasons.functions?.find((fn) => fn.name === 'reviewVerdictReason');
  const blockMessage = reviewReasons.functions?.find(
    (fn) => fn.name === 'formatReviewBlockMessage',
  );
  const unavailableReason = reviewReasons.functions?.find(
    (fn) => fn.name === 'reviewUnavailableReason',
  );

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(verdictReason).toBeDefined();
  expect(verdictReason!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(blockMessage).toBeDefined();
  expect(blockMessage!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(unavailableReason).toBeDefined();
  expect(unavailableReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('preflight keeps evidence shaping isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('function buildEvidence');
  expect(preflightSource).not.toContain('remembered session context comes from previous projscan');

  const evidence = await inspectRepoSourceFile('src/core/preflightEvidence.ts');
  const entrypoint = evidence.functions?.find((fn) => fn.name === 'buildEvidence');
  const sessionEvidence = evidence.functions?.find((fn) => fn.name === 'sessionEvidence');
  const riskSources = evidence.functions?.find((fn) => fn.name === 'riskSourcesEvidence');
  const coordination = evidence.functions?.find((fn) => fn.name === 'coordinationEvidence');

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(sessionEvidence).toBeDefined();
  expect(sessionEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(riskSources).toBeDefined();
  expect(riskSources!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(coordination).toBeDefined();
  expect(coordination!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('preflight keeps report truncation policy isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  const reportSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflightReport.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('MAX_PREFLIGHT_EVIDENCE_FILES');
  expect(preflightSource).not.toContain('evidence.session?.truncated');
  expect(preflightSource).not.toContain('isPreflightReportTruncated(');
  expect(reportSource).toContain('isPreflightReportTruncated({ evidence, changedFiles })');

  const truncation = await inspectRepoSourceFile('src/core/preflightTruncation.ts');
  const entrypoint = truncation.functions?.find((fn) => fn.name === 'isPreflightReportTruncated');

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(4);
});

test('preflight keeps suggested action shaping isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('function buildSuggestedActions');
  expect(preflightSource).not.toContain('function buildToolCalls');
  expect(preflightSource).not.toContain('Inspect the full review before continuing');

  const suggestedActions = await inspectRepoSourceFile('src/core/preflightSuggestedActions.ts');
  const entrypoint = suggestedActions.functions?.find((fn) => fn.name === 'buildSuggestedActions');
  const toolCalls = suggestedActions.functions?.find((fn) => fn.name === 'buildToolCalls');
  const actionsForReasons = suggestedActions.functions?.find(
    (fn) => fn.name === 'actionsForReasons',
  );
  const dedupe = suggestedActions.functions?.find((fn) => fn.name === 'dedupeActions');

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(toolCalls).toBeDefined();
  expect(toolCalls!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(actionsForReasons).toBeDefined();
  expect(actionsForReasons!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(dedupe).toBeDefined();
  expect(dedupe!.cyclomaticComplexity).toBeLessThanOrEqual(5);
});

test('preflight keeps contextual reason formatting isolated from the reason orchestrator', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('Remembered session context touched high-risk hotspot');
  expect(preflightSource).not.toContain('project health error(s) exist');
  expect(preflightSource).not.toContain('Swarm collision risk across');

  const contextReasons = await inspectRepoSourceFile('src/core/preflightContextReasons.ts');
  const entrypoint = contextReasons.functions?.find((fn) => fn.name === 'contextReasons');
  const sessionReasons = contextReasons.functions?.find(
    (fn) => fn.name === 'sessionHotspotReasons',
  );
  const healthReason = contextReasons.functions?.find(
    (fn) => fn.name === 'changedFileScopeHealthReason',
  );
  const coordinationReason = contextReasons.functions?.find(
    (fn) => fn.name === 'coordinationReason',
  );

  expect(entrypoint).toBeDefined();
  expect(entrypoint!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(sessionReasons).toBeDefined();
  expect(sessionReasons!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(healthReason).toBeDefined();
  expect(healthReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(coordinationReason).toBeDefined();
  expect(coordinationReason!.cyclomaticComplexity).toBeLessThanOrEqual(4);
});

test('preflight keeps review evidence collection isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('computeReview(');
  expect(preflightSource).not.toContain('review is not required before edits');
  expect(preflightSource).not.toContain('newDataflowRisks');

  const reviewEvidence = await inspectRepoSourceFile('src/core/preflightReviewEvidence.ts');
  const safeReviewEvidence = reviewEvidence.functions?.find(
    (fn) => fn.name === 'safeReviewEvidence',
  );
  const fromReport = reviewEvidence.functions?.find((fn) => fn.name === 'reviewEvidenceFromReport');

  expect(safeReviewEvidence).toBeDefined();
  expect(safeReviewEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(fromReport).toBeDefined();
  expect(fromReport!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('preflight keeps changed-file evidence collection isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('getChangedFiles(');
  expect(preflightSource).not.toContain('changed-file detection is not required before edits');

  const changedFiles = await inspectRepoSourceFile('src/core/preflightChangedFiles.ts');
  const safeChangedFiles = changedFiles.functions?.find((fn) => fn.name === 'safeChangedFiles');
  const fromResult = changedFiles.functions?.find((fn) => fn.name === 'changedFilesFromResult');

  expect(safeChangedFiles).toBeDefined();
  expect(safeChangedFiles!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  expect(fromResult).toBeDefined();
  expect(fromResult!.cyclomaticComplexity).toBeLessThanOrEqual(2);
});

test('preflight keeps local evidence collection isolated from the main preflight module', async () => {
  const preflightSource = await fs.readFile(
    path.join(process.cwd(), 'src/core/preflight.ts'),
    'utf-8',
  );
  expect(preflightSource).not.toContain('loadSession');
  expect(preflightSource).not.toContain('analyzeHotspots');
  expect(preflightSource).not.toContain('computeCoordination');

  const localEvidence = await inspectRepoSourceFile('src/core/preflightLocalEvidence.ts');
  const safeSession = localEvidence.functions?.find((fn) => fn.name === 'safeSession');
  const safeHotspots = localEvidence.functions?.find((fn) => fn.name === 'safeHotspots');
  const safeCoordination = localEvidence.functions?.find((fn) => fn.name === 'safeCoordination');

  expect(safeSession).toBeDefined();
  expect(safeSession!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(safeHotspots).toBeDefined();
  expect(safeHotspots!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(safeCoordination).toBeDefined();
  expect(safeCoordination!.cyclomaticComplexity).toBeLessThanOrEqual(4);
});

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
