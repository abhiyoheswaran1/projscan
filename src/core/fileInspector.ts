import fs from 'node:fs/promises';
import path from 'node:path';
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
import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { getAdapterFor } from './languages/registry.js';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from './indexCache.js';
import { mapExportType } from './fileExportTypes.js';
import { inferPurpose } from './filePurpose.js';

export { inferPurpose } from './filePurpose.js';

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
  // Reject absolute paths up-front. The MCP `projscan_file` tool's docs
  // describe `path` as "relative to the project root", but the prior
  // implementation silently honored absolute paths. Refusing them removes
  // an attack vector where a hostile MCP client passes /etc/passwd directly.
  if (path.isAbsolute(relOrAbsFile)) {
    return makeEmpty(
      relOrAbsFile,
      'Absolute paths are not accepted; pass a path relative to the project root.',
    );
  }
  // Canonicalize BOTH the root and the target via realpath before the
  // inside-root check. macOS's tmpdir lives at `/var/folders/...` which
  // is itself a symlink to `/private/var/folders/...`; without canonical-
  // izing the root, the resolved target's `/private/...` form would fail
  // the prefix check. Realpath of the root fails ENOENT only if the user
  // pointed at a non-existent root (caller error); fall back to the
  // resolved-without-realpath form in that case so the user gets a clear
  // downstream "File not found" error rather than a misleading "outside
  // the project root".
  const resolvedRoot = path.resolve(rootPath);
  let canonicalRoot = resolvedRoot;
  try {
    canonicalRoot = await fs.realpath(resolvedRoot);
  } catch {
    // root doesn't exist; use the unresolved form
  }
  const absolutePath = path.resolve(canonicalRoot, relOrAbsFile);

  // Resolve symlinks on the target. Without this, a symlink under the repo
  // (e.g. `cache/keys.pem` → `/etc/passwd`) passes the prefix check but
  // reads attacker-chosen content. realpath collapses the symlink so the
  // inside-root check sees the real target. ENOENT (path doesn't exist)
  // → fall back to the unresolved path; downstream stat will surface the
  // real error.
  let realPath = absolutePath;
  try {
    realPath = await fs.realpath(absolutePath);
  } catch {
    // missing path; use the unresolved form for the inside-root check.
    // path.resolve already collapsed any '..' so we won't admit traversal.
  }

  if (!isInsideRoot(realPath, canonicalRoot)) {
    return makeEmpty(relOrAbsFile, 'File is outside the project root');
  }

  let content: string;
  let sizeBytes: number;
  try {
    const stat = await fs.stat(realPath);
    if (!stat.isFile()) {
      return makeEmpty(relOrAbsFile, 'Path is not a file');
    }
    sizeBytes = stat.size;
    content = await fs.readFile(realPath, 'utf-8');
  } catch (err) {
    const msg = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'File not found' : String(err);
    return makeEmpty(relOrAbsFile, msg);
  }

  const relativePath = path.relative(canonicalRoot, absolutePath).split(path.sep).join('/');
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

  // Coupling: fan-in is direct from the graph; fan-out scans localImporters
  // for entries where this file is the importer. O(N) over local edges, fine
  // for a single-file inspection.
  let cyclomaticComplexity: number | null = null;
  let fanIn: number | null = null;
  let fanOut: number | null = null;
  let functions: FileInspection['functions'];
  const graphFileEntry = graph.files.get(relativePath);
  if (graphFileEntry) {
    cyclomaticComplexity = graphFileEntry.parseOk ? graphFileEntry.cyclomaticComplexity : null;
    fanIn = graph.localImporters.get(relativePath)?.size ?? 0;
    let fo = 0;
    for (const importers of graph.localImporters.values()) {
      if (importers.has(relativePath)) fo++;
    }
    fanOut = fo;
    if (graphFileEntry.functions && graphFileEntry.functions.length > 0) {
      functions = [...graphFileEntry.functions]
        .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
        .map((f) => ({
          name: f.name,
          line: f.line,
          endLine: f.endLine,
          cyclomaticComplexity: f.cyclomaticComplexity,
          fanIn: f.fanIn,
        }));
    }
  }

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
    cyclomaticComplexity,
    fanIn,
    fanOut,
    language,
    functions,
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

function isInsideRoot(absolutePath: string, resolvedRoot: string): boolean {
  return absolutePath === resolvedRoot || absolutePath.startsWith(resolvedRoot + path.sep);
}

function findHotspotForFile(
  report: HotspotReport | undefined,
  relativePath: string,
): FileHotspot | null {
  if (!report || !report.available) return null;
  return report.hotspots.find((h) => h.relativePath === relativePath) ?? null;
}

export function detectFileIssues(content: string, lineCount: number): string[] {
  const issues: string[] = [];

  if (lineCount > 500) issues.push(`Large file (${lineCount} lines) - consider splitting`);
  if (lineCount > 1000) issues.push('Very large file - strongly consider refactoring');

  if (/console\.(log|warn|error|debug)\s*\(/.test(content)) {
    issues.push('Contains console.log statements - consider using a proper logger');
  }

  if (/TODO|FIXME|HACK|XXX/i.test(content)) {
    issues.push('Contains TODO/FIXME comments');
  }

  if (/:\s*any\b/.test(content) && /\.tsx?$/.test(content)) {
    issues.push('Uses "any" type - consider using proper types');
  }

  return issues;
}
