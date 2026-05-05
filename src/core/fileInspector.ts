import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ExportInfo,
  FileEntry,
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

export interface InspectOptions {
  scan?: { files: FileEntry[] };
  issues?: Issue[];
  hotspots?: HotspotReport;
  /** If provided, prefer graph-derived imports/exports over regex parsing. */
  graph?: CodeGraph;
}

export async function inspectFile(
  rootPath: string,
  relOrAbsFile: string,
  options: InspectOptions = {},
): Promise<FileInspection> {
  const resolvedRoot = path.resolve(rootPath);
  const absolutePath = path.isAbsolute(relOrAbsFile)
    ? relOrAbsFile
    : path.resolve(resolvedRoot, relOrAbsFile);

  if (!isInsideRoot(absolutePath, resolvedRoot)) {
    return makeEmpty(relOrAbsFile, 'File is outside the project root');
  }

  let content: string;
  let sizeBytes: number;
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      return makeEmpty(relOrAbsFile, 'Path is not a file');
    }
    sizeBytes = stat.size;
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch (err) {
    const msg = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'File not found' : String(err);
    return makeEmpty(relOrAbsFile, msg);
  }

  const relativePath = path.relative(resolvedRoot, absolutePath).split(path.sep).join('/');
  const lines = content.split('\n');
  const adapter = getAdapterFor(relativePath);
  const language = adapter?.id;

  // Prefer graph-derived imports/exports when available. The regex extractors
  // in this file only understand JS/TS syntax and would emit garbage on
  // Python. For JS/TS we still fall back to regex when no graph is provided
  // (preserves existing behavior).
  let imports: ImportInfo[];
  let exports: ExportInfo[];
  const graphFile = options.graph?.files.get(relativePath);
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
  } else if (language === 'javascript') {
    imports = extractImports(content);
    exports = extractExports(content);
  } else {
    // Non-JS file with no graph: we don't have a safe extractor. Return empty
    // rather than running the JS regex against (e.g.) Python and emitting garbage.
    imports = [];
    exports = [];
  }
  const purpose = inferPurpose(absolutePath, exports);
  const potentialIssues = detectFileIssues(content, lines.length);

  const files = options.scan?.files ?? (await scanRepository(resolvedRoot)).files;
  const issues = options.issues ?? (await collectIssues(resolvedRoot, files));

  // Build the graph if not provided. Powers AST cyclomatic complexity, fan-in,
  // fan-out, and feeds the hotspot analyzer's CC-based risk score.
  let graph = options.graph;
  if (!graph) {
    const cached = await loadCachedGraph(resolvedRoot);
    graph = await buildCodeGraph(resolvedRoot, files, cached);
    await saveCachedGraph(resolvedRoot, graph);
  }

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

function mapExportType(kind: string): ExportInfo['type'] {
  switch (kind) {
    case 'function':
    case 'class':
    case 'variable':
    case 'type':
    case 'interface':
    case 'default':
      return kind;
    case 'enum':
      return 'type';
    default:
      return 'unknown';
  }
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

function findHotspotForFile(report: HotspotReport | undefined, relativePath: string): FileHotspot | null {
  if (!report || !report.available) return null;
  return report.hotspots.find((h) => h.relativePath === relativePath) ?? null;
}

// ── Parsing (shared with CLI/MCP) ─────────────────────────
//
// 0.17.0: `extractImports` and `extractExports` below are JS/TS-only regex
// parsers kept for backward compatibility with `projscan_explain` and the
// CLI `analyzeFile` / `explainFile` helpers. The AST-based code graph
// (`buildCodeGraph` + `LanguageAdapter.parse`) is strictly better and is
// already used as the primary path in `inspectFile` above. These regex
// helpers are scheduled for removal in a future release once all
// `projscan_explain` paths take a graph; do not add new callers.

/** @deprecated 0.17.0 — prefer `graphFile.imports` from `buildCodeGraph`. */
export function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  const addSource = (source: string) => {
    if (!seen.has(source)) {
      seen.add(source);
      imports.push({
        source,
        specifiers: [],
        isRelative: source.startsWith('.') || source.startsWith('/'),
      });
    }
  };

  // ES import - optional `type` keyword for type-only imports.
  const esImportRegex = /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = esImportRegex.exec(content)) !== null) {
    addSource(match[1]);
  }

  // ES re-export - `export ... from '...'` counts as an import from the
  // importer's point of view for graph-building purposes.
  const esReexportRegex = /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = esReexportRegex.exec(content)) !== null) {
    addSource(match[1]);
  }

  // Dynamic import()
  const dynamicRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = dynamicRegex.exec(content)) !== null) {
    addSource(match[1]);
  }

  // CommonJS require
  const requireRegex = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requireRegex.exec(content)) !== null) {
    addSource(match[1]);
  }

  return imports;
}

/** @deprecated 0.17.0 — prefer `graphFile.exports` from `buildCodeGraph`. */
export function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];

  const funcRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'function' });
  }

  const classRegex = /^export\s+class\s+(\w+)/gm;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'class' });
  }

  const varRegex = /^export\s+(?:const|let|var)\s+(\w+)/gm;
  while ((match = varRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'variable' });
  }

  const interfaceRegex = /^export\s+interface\s+(\w+)/gm;
  while ((match = interfaceRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'interface' });
  }

  const typeRegex = /^export\s+type\s+(\w+)/gm;
  while ((match = typeRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'type' });
  }

  if (/^export\s+default/m.test(content)) {
    exports.push({ name: 'default', type: 'default' });
  }

  return exports;
}

/**
 * Filename-keyword rules. Order matters — first match wins. Each pred
 * runs against the lowercase basename (without extension).
 */
const NAME_RULES: ReadonlyArray<{
  pred: (name: string) => boolean;
  label: string;
}> = [
  { pred: (n) => n.includes('test') || n.includes('spec'), label: 'Test file' },
  { pred: (n) => n.includes('config') || n.includes('rc'), label: 'Configuration file' },
  { pred: (n) => n === 'index', label: 'Module entry point / barrel file' },
  { pred: (n) => n === 'main' || n === 'app', label: 'Application entry point' },
  { pred: (n) => n.includes('route') || n.includes('router'), label: 'Route definitions' },
  { pred: (n) => n.includes('middleware'), label: 'Middleware handler' },
  { pred: (n) => n.includes('controller'), label: 'Request controller' },
  { pred: (n) => n.includes('service'), label: 'Service layer logic' },
  { pred: (n) => n.includes('model') || n.includes('schema'), label: 'Data model / schema definition' },
  { pred: (n) => n.includes('util') || n.includes('helper'), label: 'Utility functions' },
  { pred: (n) => n.includes('hook'), label: 'Custom hook' },
  { pred: (n) => n.includes('context') || n.includes('provider'), label: 'Context / state provider' },
  { pred: (n) => n.includes('type') || n.includes('interface'), label: 'Type definitions' },
  { pred: (n) => n.includes('constant'), label: 'Constants / configuration' },
  { pred: (n) => n.includes('migration'), label: 'Database migration' },
  { pred: (n) => n.includes('seed'), label: 'Database seed data' },
  { pred: (n) => n.includes('auth'), label: 'Authentication logic' },
  { pred: (n) => n.includes('api'), label: 'API endpoint handler' },
];

/** Directory-segment rules. Same first-match-wins semantics. */
const DIR_RULES: ReadonlyArray<{
  pred: (dir: string) => boolean;
  label: string;
}> = [
  { pred: (d) => d.includes('component') || d.includes('pages'), label: 'UI component' },
  { pred: (d) => d.includes('service'), label: 'Service module' },
  { pred: (d) => d.includes('model'), label: 'Data model' },
  { pred: (d) => d.includes('util') || d.includes('lib'), label: 'Library / utility module' },
];

export function inferPurpose(filePath: string, exports: ExportInfo[]): string {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dir = path.dirname(filePath).toLowerCase();
  for (const rule of NAME_RULES) if (rule.pred(name)) return rule.label;
  for (const rule of DIR_RULES) if (rule.pred(dir)) return rule.label;
  return inferPurposeFromExports(exports);
}

function inferPurposeFromExports(exports: ExportInfo[]): string {
  const exportTypes = exports.map((e) => e.type);
  if (exportTypes.includes('class')) return 'Class-based module';
  if (exportTypes.filter((t) => t === 'function').length > 2) return 'Function library';
  return 'Source module';
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
