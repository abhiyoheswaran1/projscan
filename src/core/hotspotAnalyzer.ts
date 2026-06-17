import type { FileEntry, HotspotReport, Issue } from '../types.js';
import type { CodeGraph } from './codeGraph.js';
import { buildFileHotspot } from './hotspotBuilder.js';
import { collectHotspotCandidateEvidence } from './hotspotCandidates.js';
import { collectGitChurn, countCommits, isGitRepository } from './hotspotGit.js';
import { indexIssuesByFile } from './hotspotIssues.js';
import { markAcceptedHotspots } from './hotspotMemory.js';

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
  const hotspots = candidates.map((file) => {
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
