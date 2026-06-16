import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import type { HotspotReport } from '../types.js';

interface ReviewHeadSnapshot {
  graph: CodeGraph;
  hotspots: HotspotReport;
}

export async function buildReviewHeadSnapshot(rootPath: string): Promise<ReviewHeadSnapshot> {
  const scan = await scanRepository(rootPath);
  const graph = await buildCodeGraph(rootPath, scan.files);
  const issues = await collectIssues(rootPath, scan.files);
  const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
    limit: 200,
    graph,
  });

  return { graph, hotspots };
}
