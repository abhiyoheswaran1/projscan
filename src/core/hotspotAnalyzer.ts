import type { AuthorShare, FileEntry, FileHotspot, HotspotReport, Issue } from '../types.js';
import type { CodeGraph } from './codeGraph.js';
import { collectHotspotCandidateEvidence } from './hotspotCandidates.js';
import { collectGitChurn, countCommits, isGitRepository } from './hotspotGit.js';
import { indexIssuesByFile } from './hotspotIssues.js';
import { lineCountOrEstimate } from './hotspotLines.js';
import { markAcceptedHotspots } from './hotspotMemory.js';
import { buildReasons, computeRiskScore, rankAuthors } from './hotspotScoring.js';

export { computeRiskScore } from './hotspotScoring.js';

const DEFAULT_SINCE = '12 months ago';

export interface HotspotOptions {
  since?: string;
  limit?: number;
  coverage?: Map<string, number>;
  /**
   * Code graph for AST-derived complexity. When present, the risk score uses
   * cyclomatic complexity instead of the LOC proxy. Files outside the graph
   * (no language adapter) still fall back to LOC.
   */
  graph?: CodeGraph;
}

interface BuildFileHotspotInput {
  file: FileEntry;
  churn: number;
  distinctAuthors: number;
  authorCommits?: Map<string, number>;
  lastTimestampMs?: number | null;
  lineCount?: number;
  issueIds?: string[];
  nowMs: number;
  coverage?: number | null;
  complexity?: number | null;
}

interface AuthorHotspotSummary {
  topAuthors: AuthorShare[];
  primaryAuthor: string | null;
  primaryAuthorShare: number;
  busFactorOne: boolean;
}

export async function analyzeHotspots(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
  options: HotspotOptions = {},
): Promise<HotspotReport> {
  const limit = Math.max(1, Math.min(100, options.limit ?? 10));
  const since = options.since ?? DEFAULT_SINCE;

  const isRepo = await isGitRepository(rootPath);
  if (!isRepo) {
    return {
      available: false,
      reason: 'Not a git repository - hotspot analysis requires git history',
      window: { since: null, commitsScanned: 0 },
      hotspots: [],
      totalFilesRanked: 0,
    };
  }

  const churnMap = await collectGitChurn(rootPath, since);
  const { candidates, lineCounts } = await collectHotspotCandidateEvidence(files, churnMap);

  const issueIndex = indexIssuesByFile(issues, files);

  const now = Date.now();
  const hotspots: FileHotspot[] = candidates.map((file) => {
    const churnEntry = churnMap.get(file.relativePath);

    // Prefer AST cyclomatic complexity when the graph parsed this file.
    // Files in the graph but with parseOk:false fall back to LOC too - a
    // failed parse means we can't trust the (zero) CC value.
    const graphEntry = options.graph?.files.get(file.relativePath);
    return buildFileHotspot({
      file,
      churn: churnEntry?.churn ?? 0,
      distinctAuthors: churnEntry?.authors.size ?? 0,
      authorCommits: churnEntry?.authorCommits,
      lastTimestampMs: churnEntry?.lastTimestampMs ?? null,
      lineCount: lineCounts.get(file.relativePath),
      issueIds: issueIndex.get(file.relativePath) ?? [],
      nowMs: now,
      coverage: options.coverage?.get(file.relativePath),
      complexity: graphEntry?.parseOk ? graphEntry.cyclomaticComplexity : null,
    });
  });

  hotspots.sort((a, b) => b.riskScore - a.riskScore);

  const ranked = hotspots.filter((h) => h.riskScore > 0);
  const top = ranked.slice(0, limit);

  // 1.5+ — Project Memory hotspot loop. Record the top-K into memory
  // and back-tag `accepted: true` for files that have crossed the
  // acceptance threshold. Best-effort; never breaks the report.
  await markAcceptedHotspots(rootPath, top);

  return {
    available: true,
    window: {
      since,
      commitsScanned: countCommits(churnMap),
    },
    hotspots: top,
    totalFilesRanked: ranked.length,
  };
}

function buildFileHotspot(i: BuildFileHotspotInput): FileHotspot {
  const daysSinceLastChange = daysSinceLastChangeFrom(i.nowMs, i.lastTimestampMs);
  const lines = lineCountOrEstimate(i.lineCount, i.file.sizeBytes);
  const issueIds = i.issueIds ?? [];
  const authorSummary = summarizeHotspotAuthors(i.churn, i.authorCommits);
  const coverageValue = numberOrNull(i.coverage);
  const cc = numberOrNull(i.complexity);

  const riskScore = computeRiskScore({
    churn: i.churn,
    lines,
    complexity: cc,
    authors: i.distinctAuthors,
    daysSinceLastChange,
    issueCount: issueIds.length,
    busFactorOne: authorSummary.busFactorOne,
    coverage: coverageValue,
  });

  const reasons = buildReasons({
    churn: i.churn,
    lines,
    complexity: cc,
    authors: i.distinctAuthors,
    daysSinceLastChange,
    issueCount: issueIds.length,
    busFactorOne: authorSummary.busFactorOne,
    primaryAuthor: authorSummary.primaryAuthor,
    coverage: coverageValue,
  });

  return {
    relativePath: i.file.relativePath,
    churn: i.churn,
    distinctAuthors: i.distinctAuthors,
    daysSinceLastChange,
    lineCount: lines,
    cyclomaticComplexity: cc,
    sizeBytes: i.file.sizeBytes,
    issueCount: issueIds.length,
    issueIds,
    riskScore,
    reasons,
    primaryAuthor: authorSummary.primaryAuthor,
    primaryAuthorShare: authorSummary.primaryAuthorShare,
    busFactorOne: authorSummary.busFactorOne,
    topAuthors: authorSummary.topAuthors,
    coverage: coverageValue,
  };
}

function daysSinceLastChangeFrom(nowMs: number, lastTimestampMs: number | null | undefined) {
  const lastTs = lastTimestampMs ?? null;
  if (lastTs === null) return null;
  return Math.max(0, Math.floor((nowMs - lastTs) / (1000 * 60 * 60 * 24)));
}

function summarizeHotspotAuthors(
  churn: number,
  authorCommits: Map<string, number> | undefined,
): AuthorHotspotSummary {
  const topAuthors = rankAuthors(authorCommits);
  const primaryAuthor = topAuthors[0]?.author ?? null;
  const primaryAuthorShare = topAuthors[0]?.share ?? 0;
  return {
    topAuthors,
    primaryAuthor,
    primaryAuthorShare,
    busFactorOne: churn >= 3 && primaryAuthorShare >= 0.8,
  };
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}
