import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { computeReview } from '../../src/core/review.js';
import type { FileEntry } from '../../src/types.js';

let tmp: string;
const GIT_REVIEW_TIMEOUT_MS = 60000;

vi.setConfig({ testTimeout: GIT_REVIEW_TIMEOUT_MS, hookTimeout: GIT_REVIEW_TIMEOUT_MS });

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-test-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function git(
  args: string[],
  cwd: string = tmp,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@x',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@x',
      },
    });
    let so = '';
    let se = '';
    c.stdout.on('data', (d) => (so += d.toString()));
    c.stderr.on('data', (d) => (se += d.toString()));
    c.on('close', (code) => resolve({ code: code ?? 1, stdout: so, stderr: se }));
  });
}

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

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

async function setupRepo(): Promise<void> {
  await git(['init', '-q', '-b', 'main']);
  await git(['config', 'user.email', 't@x']);
  await git(['config', 'user.name', 't']);
}

async function withFailingWorktreeAdd<T>(fn: () => Promise<T>): Promise<T> {
  const oldPath = process.env.PATH ?? '';
  const oldRealPath = process.env.PROJSCAN_TEST_REAL_PATH;
  const fakeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fake-git-'));
  const fakeGit = path.join(fakeDir, 'git');
  await fs.writeFile(
    fakeGit,
    `#!/bin/sh
if [ "$1" = "worktree" ] && [ "$2" = "add" ]; then
  echo "fatal: could not create directory of .git/worktrees/projscan-review: Operation not permitted" >&2
  exit 128
fi
PATH="$PROJSCAN_TEST_REAL_PATH" exec git "$@"
`,
    'utf-8',
  );
  await fs.chmod(fakeGit, 0o755);
  process.env.PROJSCAN_TEST_REAL_PATH = oldPath;
  process.env.PATH = `${fakeDir}${path.delimiter}${oldPath}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = oldPath;
    if (oldRealPath === undefined) {
      delete process.env.PROJSCAN_TEST_REAL_PATH;
    } else {
      process.env.PROJSCAN_TEST_REAL_PATH = oldRealPath;
    }
    await fs.rm(fakeDir, { recursive: true, force: true });
  }
}

describe('computeReview', () => {
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

  it('returns unavailable when not a git repo', async () => {
    const r = await computeReview(tmp);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Not a git repository/);
  });

  it('returns ok verdict with no changes between identical refs', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe('ok');
    expect(r.changedFiles).toHaveLength(0);
  });

  it('reviews dirty worktree changes when base and head resolve to the same commit', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/a.ts', `export const a = 2;\nexport const b = 3;\n`);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.changedFiles.map((file) => file.relativePath)).toContain('src/a.ts');
    expect(r.prDiff.totalFilesChanged).toBeGreaterThan(0);
    expect(r.summary).not.toEqual(['No structural changes detected between base and head.']);
  });

  it('returns unavailable when the base worktree cannot be checked out', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/a.ts', `export const a = 2;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'change a']);

    const r = await withFailingWorktreeAdd(() =>
      computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' }),
    );

    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Could not check out base ref "HEAD~1"/);
    expect(r.changedFiles).toEqual([]);
    expect(r.newTaintFlows).toEqual([]);
    expect(r.newDataflowRisks).toEqual([]);
  });

  it('does not block on taint or dataflow risks that only touch test files', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/a.ts',
      `export const a = 1;
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'tests/helper.test.ts',
      `import { writeFile } from 'node:fs/promises';

export function readSecret() {
  return process.env.TOKEN;
}

export async function writeSecret(value: string | undefined) {
  await writeFile('tmp-token', value ?? '');
}

export async function bridge() {
  const value = readSecret();
  return writeSecret(value);
}

export async function direct() {
  await writeFile('tmp-token', process.env.TOKEN ?? '');
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add test helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.newTaintFlows).toEqual([]);
    expect(r.newDataflowRisks).toEqual([]);
    expect(r.summary.some((line) => line.includes('taint flow'))).toBe(false);
    expect(r.summary.some((line) => line.includes('dataflow risk'))).toBe(false);
  });

  it('does not promote broad file-IO bridge dataflow to review blockers', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/cache.ts',
      `export function refresh() { return 1; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/cache.ts',
      `import { readFile, writeFile } from 'node:fs/promises';

export function readCache() {
  return readFile('cache.json', 'utf8');
}

export function saveCache(value: string) {
  return writeFile('cache.json', value);
}

export async function refresh() {
  const value = await readCache();
  return saveCache(value);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add cache refresh']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.newDataflowRisks).toEqual([]);
    expect(r.summary.some((line) => line.includes('dataflow risk'))).toBe(false);
  });

  it('does not block review on unrelated generic parse/exec dataflow collisions', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/config.ts',
      `export function safeParse(raw: string) { return JSON.parse(raw); }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/config.ts',
      `import { parse } from './version.js';

export function safeParse(raw: string) {
  return parse(raw);
}
`,
    );
    await write(
      'src/version.ts',
      `const RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parse(version: string) {
  return RE.exec(version);
}
`,
    );
    await write(
      'scripts/smoke.mjs',
      `export function exec(command) {
  return process.env.PATH ? command : '';
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add parser and smoke helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(
      r.newDataflowRisks.find(
        (risk) =>
          risk.kind === 'bridge' &&
          risk.bridgeFn === 'safeParse' &&
          risk.sourceFn === 'exec' &&
          risk.sinkFn === 'parse',
      ),
    ).toBeUndefined();
    expect(r.summary.some((line) => line.includes('safeParse'))).toBe(false);
  });

  it('flags new high-CC function as risky on file modification', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export function foo() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Modify src/a.ts to add a function with CC >= 10.
    await write(
      'src/a.ts',
      `export function foo() { return 1; }
export function bar(x) {
  if (x > 1) return 1;
  if (x > 2) return 2;
  if (x > 3) return 3;
  if (x > 4) return 4;
  if (x > 5) return 5;
  if (x > 6) return 6;
  if (x > 7) return 7;
  if (x > 8) return 8;
  if (x > 9) return 9;
  return 0;
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add bar']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    const bar = r.riskyFunctions.find((f) => f.name === 'bar');
    expect(bar).toBeDefined();
    expect(bar!.cyclomaticComplexity).toBeGreaterThanOrEqual(10);
    expect(bar!.reason).toBe('added');
    // Verdict should escalate at least to 'review' on a risky-function flag.
    expect(r.verdict === 'review' || r.verdict === 'block').toBe(true);
  });

  it('does NOT report false-positive risky-functions when a file has multiple anonymous arrows (regression)', async () => {
    // Regression for a bug live since 0.13.0:
    // findRiskyFunctions used `Map<name, cc>` keyed by fn.name. Many real
    // files have multiple INLINE arrow callbacks (no binding name → ast.ts
    // labels them '<anonymous>'), which collapsed into a single map entry.
    // Every head <anonymous> compared against the LAST base <anonymous>'s CC.
    //
    // To trigger the bug we need: (1) two inline arrows in the same file —
    // not `export const foo = ...` arrows, those bind to a name — and (2)
    // ordering such that the LAST base anon's CC differs enough from the
    // FIRST head anon's CC to cross the jump threshold. Below: base has
    // [arrow_high (CC≈8), arrow_low (CC=1)]; the buggy code stores
    // baseByName.<anonymous> = 1 (the low one, last write). Head has the
    // same two arrows unchanged, but when iterating head fns, the FIRST
    // (still CC≈8) gets paired with baseCc=1 → delta 7 ≥ CC_JUMP_THRESHOLD
    // (5) → false-positive 'jumped' on an arrow that didn't move.
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/api.ts',
      `export function api(items) {
  return items
    .filter(x => {
      if (x === 1) return true;
      if (x === 2) return true;
      if (x === 3) return true;
      if (x === 4) return true;
      if (x === 5) return true;
      if (x === 6) return true;
      if (x === 7) return true;
      return false;
    })
    .map(x => x + 1);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Head: same body unchanged + a NEW exported helper. The new export
    // is what makes prDiff classify the file as 'modified' (without a
    // structural change, prDiff.filesModified is empty and findRiskyFunctions
    // never iterates the file). The two inline arrows still have CC 8 and 1.
    // Under the buggy code: the cc=8 filter callback is paired with the
    // last-write-of-baseByName.<anonymous>=1 → delta 7 ≥ CC_JUMP_THRESHOLD
    // → 'jumped' flag on an arrow that didn't move.
    await write(
      'src/api.ts',
      `export function api(items) {
  return items
    .filter(x => {
      if (x === 1) return true;
      if (x === 2) return true;
      if (x === 3) return true;
      if (x === 4) return true;
      if (x === 5) return true;
      if (x === 6) return true;
      if (x === 7) return true;
      return false;
    })
    .map(x => x + 1);
}

export function helper() {
  return 42;
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    // Zero risky-function rows. The two inline arrows are both '<anonymous>'
    // — ambiguous pairing → skipped on both sides. helper() is newly added
    // but its CC=1 is below the threshold so it's not flagged. The outer
    // api() function is unchanged. No flag should surface.
    expect(r.riskyFunctions.filter((f) => f.file === 'src/api.ts')).toHaveLength(0);
  });

  it('detects new cycles introduced between refs', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await write('src/b.ts', `export const b = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Introduce a cycle a -> b -> a.
    await write('src/a.ts', `import { b } from './b.js';\nexport const a = b;\n`);
    await write('src/b.ts', `import { a } from './a.js';\nexport const b = a;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add cycle']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.newCycles.length).toBeGreaterThan(0);
    expect(r.newCycles[0].classification).toBe('new');
    expect(r.verdict).toBe('block');
  });

  it('flags a NEW taint flow introduced by the PR and forces verdict to block (1.6+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // Base has a benign reader.
    await write('src/handler.ts', `export function handler() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // PR introduces process.env source + exec sink in the same function.
    await write(
      'src/handler.ts',
      `import { exec } from 'child_process';
export function handler() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add exec']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.newTaintFlows.length).toBeGreaterThan(0);
    const flow = r.newTaintFlows.find((f) => f.sourceFn === 'handler');
    expect(flow).toBeDefined();
    expect(flow!.source).toBe('env');
    expect(flow!.sink).toBe('exec');
    // A new taint flow always blocks.
    expect(r.verdict).toBe('block');
    expect(r.summary.some((s) => s.includes('taint'))).toBe(true);
  });

  it('does NOT flag pre-existing taint flows in unchanged files (1.6+ regression)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // src/danger.ts already has a flow at base.
    await write(
      'src/danger.ts',
      `import { exec } from 'child_process';
export function danger() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    await write('src/other.ts', `export const x = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // PR only edits src/other.ts, leaves src/danger.ts alone.
    await write('src/other.ts', `export const x = 2;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'tweak other']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    // The flow exists at head, but it ALSO existed at base, AND the PR
    // didn't touch any file along its path — must not surface as new.
    expect(r.newTaintFlows).toHaveLength(0);
    expect(r.verdict).toBe('ok');
  });

  it('flags a NEW cross-file taint flow (source in one file, sink in another) (1.6+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // Sink file already exists at base — wraps child_process.exec.
    await write(
      'src/sink.ts',
      `import { exec } from 'child_process';
export function runIt(cmd: string | undefined) { exec(cmd ?? 'echo'); }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // PR adds a NEW source file that reads process.env and calls into the
    // existing sink wrapper. Source-fn is in src/reader.ts, sink-fn is in
    // src/sink.ts — exercises the cross-file BFS path.
    await write(
      'src/reader.ts',
      `import { runIt } from './sink.js';
export function reader() {
  const v = process.env.MY_CMD;
  runIt(v);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add reader']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    const flow = r.newTaintFlows.find((f) => f.sourceFn === 'reader');
    expect(flow).toBeDefined();
    expect(flow!.sinkFn).toBe('runIt');
    expect(flow!.source).toBe('env');
    expect(flow!.sink).toBe('exec');
    // Path crosses files: reader (src/reader.ts) → runIt (src/sink.ts).
    expect(flow!.files).toEqual(['src/reader.ts', 'src/sink.ts']);
    expect(r.verdict).toBe('block');
  });

  it('flags a NEW bridge dataflow risk introduced by the PR and forces verdict to block (3.0)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/bridge.ts', `export function bridge() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/bridge.ts',
      `import { exec } from 'child_process';

export function readSecret() {
  return process.env.TOKEN;
}

export function runDangerous(value: string | undefined) {
  exec(value ?? 'echo ok');
}

export function bridge() {
  const value = readSecret();
  return runDangerous(value);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add bridge risk']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.newTaintFlows).toHaveLength(0);
    expect(r.newDataflowRisks.some((risk) => risk.kind === 'bridge')).toBe(true);
    expect(r.graphEvidence).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        changedFiles: 1,
        dataflowRisks: 1,
      }),
    );
    expect(r.graphEvidence?.totalFunctions).toBeGreaterThanOrEqual(3);
    expect(r.graphEvidence?.totalCallEdges).toBeGreaterThanOrEqual(2);
    expect(r.verdict).toBe('block');
    expect(r.summary.some((s) => s.includes('dataflow'))).toBe(true);
  });

  it('scopes taint, dataflow, graph evidence, and verdict to the requested workspace package', async () => {
    await setupRepo();
    await write(
      'package.json',
      JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }, null, 2),
    );
    await write(
      'packages/api/package.json',
      JSON.stringify({ name: '@app/api', main: './old.js' }, null, 2),
    );
    await write(
      'packages/api/src/danger.ts',
      `export function ok() { return 1; }
`,
    );
    await write(
      'packages/api/src/a.ts',
      `export const a = 1;
`,
    );
    await write(
      'packages/api/src/b.ts',
      `export const b = 1;
`,
    );
    await write(
      'packages/ui/package.json',
      JSON.stringify({ name: '@app/ui', main: './src/view.ts' }, null, 2),
    );
    await write(
      'packages/ui/src/view.ts',
      `export function view() { return 'old'; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init monorepo']);

    await write(
      'packages/api/package.json',
      JSON.stringify({ name: '@app/api', main: './new.js' }, null, 2),
    );
    await write(
      'packages/api/src/danger.ts',
      `import { exec } from 'node:child_process';

export function runDangerous() {
  const command = process.env.API_CMD;
  exec(command ?? 'echo api');
}
`,
    );
    await write(
      'packages/api/src/a.ts',
      `import { b } from './b.js';
export const a = b;
`,
    );
    await write(
      'packages/api/src/b.ts',
      `import { a } from './a.js';
export const b = a;
`,
    );
    await write(
      'packages/ui/src/view.ts',
      `export function view() { return 'new'; }
export function button() { return 'button'; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'change api and ui']);

    const full = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(full.available).toBe(true);
    expect(full.verdict).toBe('block');
    expect(full.newTaintFlows.length + full.newDataflowRisks.length).toBeGreaterThan(0);

    const scoped = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD', package: '@app/ui' });
    expect(scoped.available).toBe(true);
    expect(scoped.verdict).not.toBe('block');
    expect(scoped.changedFiles.map((file) => file.relativePath)).toEqual([
      'packages/ui/src/view.ts',
    ]);
    expect(scoped.newCycles).toEqual([]);
    expect(scoped.newTaintFlows).toEqual([]);
    expect(scoped.newDataflowRisks).toEqual([]);
    expect((scoped.contractChanges ?? []).map((change) => change.file)).toEqual([
      'packages/ui/src/view.ts',
    ]);
    expect(scoped.graphEvidence?.changedFiles).toBe(1);
    expect(scoped.graphEvidence?.totalFunctions).toBe(2);
    expect(scoped.graphEvidence?.totalPackages).toBe(0);
    expect(scoped.graphEvidence?.topPackages).toEqual([]);
    expect(scoped.graphEvidence?.dataflowRisks).toBe(0);
    expect(
      scoped.summary.some(
        (line) =>
          line.includes('dataflow risk') ||
          line.includes('taint flow') ||
          line.includes('import cycle'),
      ),
    ).toBe(false);
  });

  it('suppresses default generated-code taint and dataflow review blockers but keeps custom risks', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      '.projscanrc.json',
      JSON.stringify({ taint: { sources: ['customSource'], sinks: ['customSink'] } }, null, 2),
    );
    await write(
      'src/__generated__/client.ts',
      `export function generatedClient() { return 1; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init generated client']);

    await write(
      'src/__generated__/client.ts',
      `import { exec } from 'node:child_process';

export function generatedClient() {
  const command = process.env.GENERATED_CMD;
  exec(command ?? 'echo generated');
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'default generated flow']);

    const defaultGenerated = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(defaultGenerated.available).toBe(true);
    expect(defaultGenerated.newTaintFlows).toEqual([]);
    expect(defaultGenerated.newDataflowRisks).toEqual([]);
    expect(defaultGenerated.verdict).not.toBe('block');

    await write(
      'src/__generated__/client.ts',
      `declare function customSource(): string;
declare function customSink(value: string): void;

export function generatedClient() {
  const value = customSource();
  customSink(value);
}

export function readGenerated() {
  return customSource();
}

export function sendGenerated(value: string) {
  customSink(value);
}

export function generatedBridge() {
  const value = readGenerated();
  sendGenerated(value);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'custom generated flow']);

    const customGenerated = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(customGenerated.available).toBe(true);
    expect(customGenerated.newTaintFlows.some((flow) => flow.source === 'customSource')).toBe(true);
    expect(customGenerated.newDataflowRisks.some((risk) => risk.source === 'customSource')).toBe(
      true,
    );
    expect(customGenerated.verdict).toBe('block');
  });

  it('reports dependency additions in package.json', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { axios: '^1.0.0' } }, null, 2),
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add axios']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.dependencyChanges).toHaveLength(1);
    const change = r.dependencyChanges[0];
    expect(change.added).toContainEqual({ name: 'axios', version: '^1.0.0', kind: 'dep' });
  });

  it('labels release-scale review blocks as manual sign-off', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', dependencies: {} }, null, 2));
    await write('src/hot.ts', `export const value = 0;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    for (let i = 1; i <= 5; i++) {
      await write('src/hot.ts', `export const value = ${i};\n`);
      await git(['add', '.']);
      await git(['commit', '-q', '-m', `churn ${i}`]);
    }

    await write(
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { axios: '^1.0.0' } }, null, 2),
    );
    await write('src/hot.ts', `export const value = 6;\nexport const releaseGate = true;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'release-scale change']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.verdict).toBe('block');
    expect(r.riskyFunctions).toEqual([]);
    expect(r.newTaintFlows).toEqual([]);
    expect(r.newDataflowRisks).toEqual([]);
    expect(r.contractChanges ?? []).toEqual([]);
    expect(r.summary.some((line) => line.includes('Maximum changed-file risk score'))).toBe(true);
    expect(r.summary).toContain('Dependency changes: +1 -0 ~0.');
    expect(r.summary.some((line) => line.toLowerCase().includes('manual release sign-off'))).toBe(
      true,
    );
  });

  it('reports exported symbol contract changes', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: 'dist/api.js' }));
    await write('src/api.ts', `export function oldApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    for (let i = 2; i <= 6; i++) {
      await write('src/api.ts', `export function oldApi() { return ${i}; }\n`);
      await git(['add', '.']);
      await git(['commit', '-q', '-m', `churn api ${i}`]);
    }

    await write('src/api.ts', `export function newApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'replace api']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'export-renamed',
          file: 'src/api.ts',
          symbol: 'newApi',
          before: 'oldApi',
          after: 'newApi',
          confidence: 'high',
        }),
      ]),
    );
    expect(r.contractChanges?.[0].why).toMatch(/downstream/i);
    expect(r.summary.some((line) => line.toLowerCase().includes('manual release sign-off'))).toBe(
      false,
    );
  });

  it('does not report internal helper exports as public contract changes', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './dist/index.js' }));
    await write('src/index.ts', `export function publicApi() { return 1; }\n`);
    await write('src/core/helper.ts', `export function existingHelper() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/core/helper.ts',
      `export function existingHelper() { return 1; }
export function newHelper() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add internal helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges ?? []).toEqual([]);
  });

  it('reports exports added in files re-exported by package entrypoints', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './dist/index.js' }));
    await write('src/index.ts', `export * from './api.js';\n`);
    await write('src/api.ts', `export function oldApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/api.ts',
      `export function oldApi() { return 1; }
export function newApi() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add reexported api']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'export-added',
          file: 'src/api.ts',
          symbol: 'newApi',
          confidence: 'high',
        }),
      ]),
    );
  });

  it('reports exports added in source files for declaration entrypoints', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', types: 'dist/index.d.ts' }));
    await write('src/index.ts', `export function oldApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/index.ts',
      `export function oldApi() { return 1; }
export function newApi() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add declaration api']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'export-added',
          file: 'src/index.ts',
          symbol: 'newApi',
          confidence: 'high',
        }),
      ]),
    );
  });

  it('reports package entrypoint contract changes', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './old.js' }, null, 2));
    await write('old.js', `export const value = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('package.json', JSON.stringify({ name: 'x', main: './new.js' }, null, 2));
    await write('new.js', `export const value = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'move entrypoint']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entrypoint-changed',
          file: 'package.json',
          symbol: 'main',
          before: './old.js',
          after: './new.js',
          confidence: 'high',
        }),
      ]),
    );
  });

  it('annotates findings with intent alignment when intent is passed (1.9+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/auth.ts', `export function login() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Add a new file in the auth module — matches the stated intent.
    await write('src/auth/session.ts', `export function newSession() { return {}; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add session']);

    const r = await computeReview(tmp, {
      base: 'HEAD~1',
      head: 'HEAD',
      intent: 'Add session management to auth',
    });
    expect(r.available).toBe(true);
    expect(r.intent).toBeDefined();
    expect(r.intent?.action).toBe('feature');
    expect(r.intent?.scopeTokens).toContain('auth');
    expect(r.intentAnalysis).toBeDefined();
    // The new src/auth/session.ts should be expected (feature + auth scope).
    const newFile = r.changedFiles.find((f) => f.relativePath === 'src/auth/session.ts');
    expect(newFile?.intentAlignment).toBe('expected');
    // Summary picks up an intent bullet.
    expect(r.summary.some((s) => /Intent:/.test(s))).toBe(true);
    // Verdict-flavoring sanity: verdict is one of the documented values.
    expect(['ok', 'review', 'block']).toContain(r.verdict);
  });

  it('omits intent fields when no intent is passed (1.9+ default)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);
    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });
    expect(r.intent).toBeUndefined();
    expect(r.intentAnalysis).toBeUndefined();
  });
});
