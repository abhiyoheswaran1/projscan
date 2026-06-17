import type { FileEntry, HotspotReport, Issue } from '../types.js';
import type { CodeGraph } from './codeGraph.js';
import { collectHotspotCandidateEvidence } from './hotspotCandidates.js';
import { collectGitChurn, countCommits, isGitRepository } from './hotspotGit.js';
import { indexIssuesByFile } from './hotspotIssues.js';
import { markAcceptedHotspots } from './hotspotMemory.js';
import { rankHotspotFiles } from './hotspotRanking.js';

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

  const ranked = rankHotspotFiles({
    candidates,
    churnMap,
    lineCounts,
    issueIndex,
    nowMs: Date.now(),
    coverage: options.coverage,
    graph: options.graph,
  });
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
