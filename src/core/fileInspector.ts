import type {
  ExportInfo,
  FileEntry,
  FileExplanation,
  FileInspection,
  FileHotspot,
  HotspotReport,
  ImportInfo,
  Issue,
} from '../types.js';
import { readProjectFile } from './fileAccess.js';
import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { getAdapterFor } from './languages/registry.js';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from './indexCache.js';
import { mapExportType } from './fileExportTypes.js';
import { deriveFileGraphMetrics } from './fileGraphMetrics.js';
import { detectFileIssues } from './fileIssues.js';
import { inferPurpose } from './filePurpose.js';

export { inferPurpose } from './filePurpose.js';
export { detectFileIssues } from './fileIssues.js';

export interface InspectOptions {
  scan?: { files: FileEntry[] };
  issues?: Issue[];
  hotspots?: HotspotReport;
  /** If provided, prefer graph-derived imports/exports over regex parsing. */
  graph?: CodeGraph;
}

export async function explainFile(
  rootPath: string,
  relOrAbsFile: string,
  options: InspectOptions = {},
): Promise<FileExplanation> {
  const inspection = await inspectFile(rootPath, relOrAbsFile, options);
  if (!inspection.exists) {
    throw new Error(inspection.reason ?? 'File not found');
  }
  return {
    filePath: inspection.relativePath,
    purpose: inspection.purpose,
    imports: inspection.imports,
    exports: inspection.exports,
    potentialIssues: inspection.potentialIssues,
    lineCount: inspection.lineCount,
  };
}

export async function inspectFile(
  rootPath: string,
  relOrAbsFile: string,
  options: InspectOptions = {},
): Promise<FileInspection> {
  const fileRead = await readProjectFile(rootPath, relOrAbsFile);
  if (!fileRead.ok) {
    return makeEmpty(fileRead.relativePath, fileRead.reason);
  }

  const { resolvedRoot, absolutePath, relativePath, content, sizeBytes } = fileRead.file;
  const lines = content.split('\n');
  const adapter = getAdapterFor(relativePath);
  const language = adapter?.id;

  const files = options.scan?.files ?? (await scanRepository(resolvedRoot)).files;
  const issues = options.issues ?? (await collectIssues(resolvedRoot, files));

  // Build the graph before deriving imports/exports. The removed regex
  // extractors only understood JS/TS and emitted misleading metadata for
  // other languages.
  let graph = options.graph;
  if (!graph) {
    const cached = await loadCachedGraph(resolvedRoot);
    graph = await buildCodeGraph(resolvedRoot, files, cached);
    await saveCachedGraph(resolvedRoot, graph);
  }

  let imports: ImportInfo[] = [];
  let exports: ExportInfo[] = [];
  const graphFile = graph.files.get(relativePath);
  if (graphFile) {
    imports = graphFile.imports.map((i) => ({
      source: i.source,
      specifiers: i.specifiers,
      isRelative: i.source.startsWith('.') || i.source.startsWith('/'),
    }));
    exports = graphFile.exports.map((e) => ({
      name: e.name,
      type: mapExportType(e.kind),
    }));
  }
  const purpose = inferPurpose(absolutePath, exports);
  const potentialIssues = detectFileIssues(content, lines.length);

  const hotspotReport =
    options.hotspots ?? (await analyzeHotspots(resolvedRoot, files, issues, { limit: 100, graph }));

  const hotspot = findHotspotForFile(hotspotReport, relativePath);
  const relatedIssues = issues.filter((issue) =>
    (issue.title + '\n' + issue.description).includes(relativePath),
  );

  const graphMetrics = deriveFileGraphMetrics(graph, relativePath);

  return {
    relativePath,
    exists: true,
    purpose,
    lineCount: lines.length,
    sizeBytes,
    imports,
    exports,
    potentialIssues,
    hotspot,
    issues: relatedIssues,
    cyclomaticComplexity: graphMetrics.cyclomaticComplexity,
    fanIn: graphMetrics.fanIn,
    fanOut: graphMetrics.fanOut,
    language,
    functions: graphMetrics.functions,
  };
}

function makeEmpty(relativePath: string, reason: string): FileInspection {
  return {
    relativePath,
    exists: false,
    reason,
    purpose: '',
    lineCount: 0,
    sizeBytes: 0,
    imports: [],
    exports: [],
    potentialIssues: [],
    hotspot: null,
    issues: [],
  };
}

function findHotspotForFile(
  report: HotspotReport | undefined,
  relativePath: string,
): FileHotspot | null {
  if (!report || !report.available) return null;
  return report.hotspots.find((h) => h.relativePath === relativePath) ?? null;
}
