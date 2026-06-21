import type { FileEntry, FileInspection, HotspotReport, Issue } from '../types.js';
import type { ProjectFileRead } from './fileAccess.js';
import type { CodeGraph } from './codeGraph.js';
import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { getAdapterFor } from './languages/registry.js';
import {
  exportsFromGraphFile,
  importsFromGraphFile,
  resolveInspectionGraph,
} from './fileInspectionGraph.js';
import { collectFileInspectionEvidence } from './fileInspectionEvidence.js';
import { deriveFileGraphMetrics } from './fileGraphMetrics.js';
import { detectFileIssues } from './fileIssues.js';
import { inferPurpose } from './filePurpose.js';
import { quoteShellArg } from './startShellArgs.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';

export interface InspectOptions {
  scan?: { files: FileEntry[] };
  issues?: Issue[];
  hotspots?: HotspotReport;
  /** If provided, prefer graph-derived imports/exports over regex parsing. */
  graph?: CodeGraph;
}

export async function inspectExistingProjectFile(
  file: ProjectFileRead,
  options: InspectOptions = {},
): Promise<FileInspection> {
  const { resolvedRoot, absolutePath, relativePath, content, sizeBytes } = file;
  const lines = content.split('\n');
  const adapter = getAdapterFor(relativePath);
  const language = adapter?.id;

  const files = options.scan?.files ?? (await scanRepository(resolvedRoot)).files;
  const issues = options.issues ?? (await collectIssues(resolvedRoot, files));

  const graph = await resolveInspectionGraph(resolvedRoot, files, options.graph);
  const graphFile = graph.files.get(relativePath);
  const imports = importsFromGraphFile(graphFile);
  const exports = exportsFromGraphFile(graphFile);
  const purpose = inferPurpose(absolutePath, exports);
  const potentialIssues = detectFileIssues(content, lines.length);

  const hotspotReport =
    options.hotspots ?? (await analyzeHotspots(resolvedRoot, files, issues, { limit: 100, graph }));

  const relatedEvidence = collectFileInspectionEvidence({
    files,
    issues,
    hotspots: hotspotReport,
    relativePath,
  });

  const graphMetrics = deriveFileGraphMetrics(graph, relativePath);
  const suggestedNextActions = buildSuggestedNextActions(relativePath, relatedEvidence);

  return {
    relativePath,
    exists: true,
    purpose,
    lineCount: lines.length,
    sizeBytes,
    imports,
    exports,
    potentialIssues,
    hotspot: relatedEvidence.hotspot,
    issues: relatedEvidence.issues,
    cyclomaticComplexity: graphMetrics.cyclomaticComplexity,
    fanIn: graphMetrics.fanIn,
    fanOut: graphMetrics.fanOut,
    language,
    suggestedNextActions,
    functions: graphMetrics.functions,
  };
}

function buildSuggestedNextActions(
  relativePath: string,
  evidence: ReturnType<typeof collectFileInspectionEvidence>,
): PreflightSuggestedAction[] {
  const testQuery = `tests for ${relativePath}`;
  const actions: PreflightSuggestedAction[] = [
    {
      label: 'Check impact before editing',
      command: `projscan impact ${quoteShellArg(relativePath)} --format json`,
      tool: 'projscan_impact',
      args: { file: relativePath },
    },
  ];
  const firstIssue = evidence.issues[0];
  if (firstIssue) {
    actions.push({
      label: `Explain ${firstIssue.id}`,
      command: `projscan explain-issue ${quoteShellArg(firstIssue.id)} --format json`,
      tool: 'projscan_explain_issue',
      args: { issueId: firstIssue.id },
    });
  }
  if (evidence.hotspot) {
    actions.push({
      label: 'Review hotspot context',
      command: 'projscan hotspots --format json',
      tool: 'projscan_hotspots',
    });
  }
  actions.push({
    label: 'Find tests for this file',
    command: `projscan search ${quoteShellArg(testQuery)} --format json`,
    tool: 'projscan_search',
    args: { query: testQuery },
  });
  return actions.slice(0, 4);
}
