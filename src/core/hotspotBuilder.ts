import type { AuthorShare, FileEntry, FileHotspot } from '../types.js';
import { lineCountOrEstimate } from './hotspotLines.js';
import { buildReasons, computeRiskScore, rankAuthors } from './hotspotScoring.js';

export interface BuildFileHotspotInput {
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

export function buildFileHotspot(i: BuildFileHotspotInput): FileHotspot {
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
