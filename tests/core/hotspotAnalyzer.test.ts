import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { analyzeHotspots, computeRiskScore } from '../../src/core/hotspotAnalyzer.js';
import { buildCodeGraph, type CodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import type { FileEntry, Issue } from '../../src/types.js';

const execFileAsync = promisify(execFile);

describe('computeRiskScore', () => {
  it('keeps hotspot scoring and reasons isolated from the analyzer orchestrator', async () => {
    const analyzer = await inspectRepoSourceFile('src/core/hotspotAnalyzer.ts');
    const scoringFunctions = new Set([
      'computeRiskScore',
      'buildReasons',
      'pushChurnReason',
      'pushSizeReason',
      'pushAuthorsReason',
      'pushIssuesReason',
      'pushRecencyReason',
      'pushBusFactorReason',
      'pushCoverageReason',
    ]);
    expect(analyzer.functions?.some((fn) => scoringFunctions.has(fn.name))).toBe(false);

    const scoring = await inspectRepoSourceFile('src/core/hotspotScoring.ts');
    const computeRiskScore = scoring.functions?.find((fn) => fn.name === 'computeRiskScore');
    const buildReasons = scoring.functions?.find((fn) => fn.name === 'buildReasons');

    expect(computeRiskScore).toBeDefined();
    expect(computeRiskScore!.cyclomaticComplexity).toBeLessThanOrEqual(8);
    expect(buildReasons).toBeDefined();
    expect(buildReasons!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps line counting and LOC fallback isolated from the analyzer orchestrator', async () => {
    const analyzer = await inspectRepoSourceFile('src/core/hotspotAnalyzer.ts');
    const lineFunctions = new Set(['countLines', 'lineCountOrEstimate', 'estimateLines']);
    expect(analyzer.functions?.some((fn) => lineFunctions.has(fn.name))).toBe(false);

    const lineModule = await inspectRepoSourceFile('src/core/hotspotLines.ts');
    const countLines = lineModule.functions?.find((fn) => fn.name === 'countLines');
    const lineCountOrEstimate = lineModule.functions?.find(
      (fn) => fn.name === 'lineCountOrEstimate',
    );

    expect(countLines).toBeDefined();
    expect(countLines!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(lineCountOrEstimate).toBeDefined();
    expect(lineCountOrEstimate!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  });

  it('keeps hotspot memory tagging isolated from the analyzer orchestrator', async () => {
    const analyzer = await inspectRepoSourceFile('src/core/hotspotAnalyzer.ts');
    expect(analyzer.functions?.some((fn) => fn.name === 'markAcceptedHotspots')).toBe(false);

    const memoryModule = await inspectRepoSourceFile('src/core/hotspotMemory.ts');
    const markAcceptedHotspots = memoryModule.functions?.find(
      (fn) => fn.name === 'markAcceptedHotspots',
    );

    expect(markAcceptedHotspots).toBeDefined();
    expect(markAcceptedHotspots!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps hotspot candidate selection and line reads isolated from the analyzer orchestrator', async () => {
    const analyzerSource = await fs.readFile(
      path.join(process.cwd(), 'src/core/hotspotAnalyzer.ts'),
      'utf-8',
    );
    expect(analyzerSource).not.toContain('CODE_EXTENSIONS');
    expect(analyzerSource).not.toContain('MAX_LINE_READS');
    expect(analyzerSource).not.toContain('MAX_LINE_READ_BYTES');
    expect(analyzerSource).not.toContain('candidatesByScore');

    const candidatesModule = await inspectRepoSourceFile('src/core/hotspotCandidates.ts');
    const collectEvidence = candidatesModule.functions?.find(
      (fn) => fn.name === 'collectHotspotCandidateEvidence',
    );
    const selectCandidates = candidatesModule.functions?.find(
      (fn) => fn.name === 'selectHotspotCandidates',
    );
    const rankLineReadTargets = candidatesModule.functions?.find(
      (fn) => fn.name === 'rankLineReadTargets',
    );

    expect(collectEvidence).toBeDefined();
    expect(collectEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(selectCandidates).toBeDefined();
    expect(selectCandidates!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(rankLineReadTargets).toBeDefined();
    expect(rankLineReadTargets!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps per-file hotspot assembly isolated from the analyzer orchestrator', async () => {
    const analyzer = await inspectRepoSourceFile('src/core/hotspotAnalyzer.ts');
    expect(analyzer.functions?.some((fn) => fn.name === 'buildFileHotspot')).toBe(false);
    expect(analyzer.functions?.some((fn) => fn.name === 'summarizeHotspotAuthors')).toBe(false);
    expect(analyzer.functions?.some((fn) => fn.name === 'daysSinceLastChangeFrom')).toBe(false);

    const builder = await inspectRepoSourceFile('src/core/hotspotBuilder.ts');
    const buildFileHotspot = builder.functions?.find((fn) => fn.name === 'buildFileHotspot');
    const summarizeAuthors = builder.functions?.find(
      (fn) => fn.name === 'summarizeHotspotAuthors',
    );

    expect(buildFileHotspot).toBeDefined();
    expect(buildFileHotspot!.cyclomaticComplexity).toBeLessThanOrEqual(2);
    expect(summarizeAuthors).toBeDefined();
    expect(summarizeAuthors!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps per-file hotspot ranking isolated from the analyzer orchestrator', async () => {
    const analyzerSource = await fs.readFile(
      path.join(process.cwd(), 'src/core/hotspotAnalyzer.ts'),
      'utf-8',
    );
    expect(analyzerSource).not.toContain('candidates.map');
    expect(analyzerSource).not.toContain('buildRankedFileHotspot');

    const ranking = await inspectRepoSourceFile('src/core/hotspotRanking.ts');
    const rankHotspotFiles = ranking.functions?.find((fn) => fn.name === 'rankHotspotFiles');
    const buildRankedFileHotspot = ranking.functions?.find(
      (fn) => fn.name === 'buildRankedFileHotspot',
    );

    expect(rankHotspotFiles).toBeDefined();
    expect(rankHotspotFiles!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(buildRankedFileHotspot).toBeDefined();
    expect(buildRankedFileHotspot!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('returns 0 for untouched files with no issues', () => {
    const score = computeRiskScore({
      churn: 0,
      lines: 100,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 0,
    });
    expect(score).toBe(0);
  });

  it('non-zero when file has open issues but no churn', () => {
    const score = computeRiskScore({
      churn: 0,
      lines: 50,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 2,
    });
    expect(score).toBeGreaterThan(0);
  });

  it('high churn + high complexity produces higher score than either alone', () => {
    const combined = computeRiskScore({
      churn: 40,
      lines: 800,
      authors: 3,
      daysSinceLastChange: 10,
      issueCount: 1,
    });
    const justChurn = computeRiskScore({
      churn: 40,
      lines: 1,
      authors: 3,
      daysSinceLastChange: 10,
      issueCount: 1,
    });
    const justComplexity = computeRiskScore({
      churn: 0,
      lines: 800,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 1,
    });
    expect(combined).toBeGreaterThan(justChurn);
    expect(combined).toBeGreaterThan(justComplexity);
  });

  it('recent changes get a recency boost', () => {
    const recent = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 2,
      daysSinceLastChange: 3,
      issueCount: 0,
    });
    const stale = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 2,
      daysSinceLastChange: 400,
      issueCount: 0,
    });
    expect(recent).toBeGreaterThan(stale);
  });

  it('scales monotonically with churn', () => {
    const low = computeRiskScore({
      churn: 2,
      lines: 100,
      authors: 1,
      daysSinceLastChange: 60,
      issueCount: 0,
    });
    const high = computeRiskScore({
      churn: 50,
      lines: 100,
      authors: 1,
      daysSinceLastChange: 60,
      issueCount: 0,
    });
    expect(high).toBeGreaterThan(low);
  });

  it('issues contribute meaningfully to the score', () => {
    const noIssues = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const withIssues = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 3,
    });
    expect(withIssues - noIssues).toBeGreaterThanOrEqual(30);
  });

  it('bus-factor-1 files get an additional penalty', () => {
    const base = computeRiskScore({
      churn: 10,
      lines: 300,
      authors: 2,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const withBus = computeRiskScore({
      churn: 10,
      lines: 300,
      authors: 2,
      daysSinceLastChange: 30,
      issueCount: 0,
      busFactorOne: true,
    });
    expect(withBus).toBeGreaterThan(base);
    expect(withBus - base).toBeGreaterThanOrEqual(10);
  });

  // ── 0.11 LOC -> CC swap ─────────────────────────────────

  it('0.11: when complexity is provided, score uses it instead of lines', () => {
    // Same churn etc., big-file-but-low-CC vs small-file-but-high-CC: CC wins.
    const bigFileSimple = computeRiskScore({
      churn: 10,
      lines: 800,
      complexity: 5,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const smallFileGnarly = computeRiskScore({
      churn: 10,
      lines: 80,
      complexity: 60,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    expect(smallFileGnarly).toBeGreaterThan(bigFileSimple);
  });

  it('0.11: complexity=null falls back to lines (non-AST language behavior)', () => {
    const withFallback = computeRiskScore({
      churn: 10,
      lines: 200,
      complexity: null,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const withoutComplexityField = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    expect(withFallback).toBe(withoutComplexityField);
  });
});

describe('analyzeHotspots', () => {
  it('combines churn, author concentration, issues, coverage, and complexity evidence', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-hotspot-evidence-'));
    try {
      await initRepo(dir);
      const file = await commitHotspotHistory(dir, 'src/hot.ts');
      const graph = graphWithComplexity(file.relativePath, 31);
      const issues: Issue[] = [
        {
          id: 'issue-1',
          title: 'hot path risk',
          description: 'tracked by location',
          severity: 'warning',
          category: 'test',
          fixAvailable: false,
          locations: [{ file: file.relativePath }],
        },
      ];

      const report = await analyzeHotspots(dir, [file], issues, {
        limit: 10,
        coverage: new Map([[file.relativePath, 35.2]]),
        graph,
      });
      const hotspot = report.hotspots.find((h) => h.relativePath === file.relativePath);

      expect(hotspot).toMatchObject({
        relativePath: 'src/hot.ts',
        churn: 5,
        distinctAuthors: 2,
        lineCount: 120,
        cyclomaticComplexity: 31,
        issueCount: 1,
        issueIds: ['issue-1'],
        primaryAuthor: 'owner@example.com',
        primaryAuthorShare: 0.8,
        busFactorOne: true,
        coverage: 35.2,
      });
      expect(hotspot?.daysSinceLastChange).not.toBeNull();
      expect(hotspot?.daysSinceLastChange).toBeLessThanOrEqual(7);
      expect(hotspot?.topAuthors).toEqual([
        { author: 'owner@example.com', commits: 4, share: 0.8 },
        { author: 'peer@example.com', commits: 1, share: 0.2 },
      ]);
      expect(hotspot?.reasons).toEqual(
        expect.arrayContaining([
          '5 commits',
          'high complexity (CC 31)',
          '2 contributors',
          '1 open issue',
          'changed this week',
          'bus factor 1 (owner)',
          'low coverage (35%)',
        ]),
      );
      expect(hotspot?.riskScore).toBeGreaterThan(0);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

async function initRepo(dir: string): Promise<void> {
  await execFileAsync('git', ['init', '-q', '--initial-branch=main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 'test'], { cwd: dir });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
}

async function commitHotspotHistory(dir: string, rel: string): Promise<FileEntry> {
  for (let commit = 0; commit < 5; commit++) {
    const email = commit < 4 ? 'owner@example.com' : 'peer@example.com';
    await execFileAsync('git', ['config', 'user.email', email], { cwd: dir });
    await writeHotspotFile(dir, rel, commit);
    await execFileAsync('git', ['add', rel], { cwd: dir });
    await execFileAsync('git', ['commit', '-q', '-m', `hotspot ${commit}`], { cwd: dir });
  }

  const absolutePath = path.join(dir, rel);
  const stat = await fs.stat(absolutePath);
  return {
    relativePath: rel,
    absolutePath,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.dirname(rel),
  };
}

async function writeHotspotFile(dir: string, rel: string, commit: number): Promise<void> {
  const absolutePath = path.join(dir, rel);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const lines = Array.from({ length: 120 }, (_, line) => `export const v${line} = ${commit};`);
  await fs.writeFile(absolutePath, lines.join('\n'));
}

function graphWithComplexity(relativePath: string, cyclomaticComplexity: number): CodeGraph {
  return {
    files: new Map([
      [
        relativePath,
        {
          relativePath,
          imports: [],
          exports: [],
          callSites: [],
          lineCount: 120,
          cyclomaticComplexity,
          mtimeMs: 0,
          parseOk: true,
        },
      ],
    ]),
    packageImporters: new Map(),
    localImporters: new Map(),
    symbolDefs: new Map(),
    scannedFiles: 1,
  };
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
