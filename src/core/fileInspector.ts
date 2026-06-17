import type {
  FileEntry,
  FileExplanation,
  FileInspection,
  HotspotReport,
  Issue,
} from '../types.js';
import { readProjectFile } from './fileAccess.js';
import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { getAdapterFor } from './languages/registry.js';
import type { CodeGraph } from './codeGraph.js';
import {
  exportsFromGraphFile,
  importsFromGraphFile,
  resolveInspectionGraph,
} from './fileInspectionGraph.js';
import { collectFileInspectionEvidence } from './fileInspectionEvidence.js';
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
