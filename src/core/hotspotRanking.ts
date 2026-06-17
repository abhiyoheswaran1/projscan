import type { FileEntry, FileHotspot } from '../types.js';
import type { CodeGraph } from './codeGraph.js';
import { buildFileHotspot } from './hotspotBuilder.js';
import type { ChurnEntry } from './hotspotGit.js';

export interface RankHotspotFilesInput {
  candidates: FileEntry[];
  churnMap: Map<string, ChurnEntry>;
  lineCounts: Map<string, number>;
  issueIndex: Map<string, string[]>;
  nowMs: number;
  coverage?: Map<string, number>;
  graph?: CodeGraph;
}

interface RankedChurnEvidence {
  churn: number;
  distinctAuthors: number;
  authorCommits?: Map<string, number>;
  lastTimestampMs: number | null;
}

export function rankHotspotFiles(input: RankHotspotFilesInput): FileHotspot[] {
  return input.candidates
    .map((file) => buildRankedFileHotspot(file, input))
    .sort((a, b) => b.riskScore - a.riskScore)
    .filter((hotspot) => hotspot.riskScore > 0);
}

function buildRankedFileHotspot(
  file: FileEntry,
  input: RankHotspotFilesInput,
): FileHotspot {
  const churn = rankedChurnEvidence(input.churnMap.get(file.relativePath));

  return buildFileHotspot({
    file,
    churn: churn.churn,
    distinctAuthors: churn.distinctAuthors,
    authorCommits: churn.authorCommits,
    lastTimestampMs: churn.lastTimestampMs,
    lineCount: input.lineCounts.get(file.relativePath),
    issueIds: input.issueIndex.get(file.relativePath) ?? [],
    nowMs: input.nowMs,
    coverage: input.coverage?.get(file.relativePath),
    complexity: parsedGraphComplexity(input.graph, file.relativePath),
  });
}

function rankedChurnEvidence(churnEntry: ChurnEntry | undefined): RankedChurnEvidence {
  if (!churnEntry) {
    return {
      churn: 0,
      distinctAuthors: 0,
      lastTimestampMs: null,
    };
  }
  return {
    churn: churnEntry.churn,
    distinctAuthors: churnEntry.authors.size,
    authorCommits: churnEntry.authorCommits,
    lastTimestampMs: churnEntry.lastTimestampMs,
  };
}

function parsedGraphComplexity(graph: CodeGraph | undefined, relativePath: string): number | null {
  const graphEntry = graph?.files.get(relativePath);
  if (!graphEntry?.parseOk) return null;
  return graphEntry.cyclomaticComplexity;
}
