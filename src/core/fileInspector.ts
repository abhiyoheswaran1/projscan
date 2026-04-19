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

export interface InspectOptions {
  scan?: { files: FileEntry[] };
  issues?: Issue[];
  hotspots?: HotspotReport;
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
  const imports = extractImports(content);
  const exports = extractExports(content);
  const purpose = inferPurpose(absolutePath, exports);
  const potentialIssues = detectFileIssues(content, lines.length);

  const files = options.scan?.files ?? (await scanRepository(resolvedRoot)).files;
  const issues = options.issues ?? (await collectIssues(resolvedRoot, files));
  const hotspotReport =
    options.hotspots ?? (await analyzeHotspots(resolvedRoot, files, issues, { limit: 100 }));

  const hotspot = findHotspotForFile(hotspotReport, relativePath);
  const relatedIssues = issues.filter((issue) =>
    (issue.title + '\n' + issue.description).includes(relativePath),
  );

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

function findHotspotForFile(report: HotspotReport | undefined, relativePath: string): FileHotspot | null {
  if (!report || !report.available) return null;
  return report.hotspots.find((h) => h.relativePath === relativePath) ?? null;
}

// ── Parsing (shared with CLI/MCP) ─────────────────────────

export function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seen = new Set<string>();

  const esImportRegex = /import\s+(?:(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = esImportRegex.exec(content)) !== null) {
    const source = match[1];
    if (!seen.has(source)) {
      seen.add(source);
      imports.push({
        source,
        specifiers: [],
        isRelative: source.startsWith('.') || source.startsWith('/'),
      });
    }
  }

  const requireRegex = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requireRegex.exec(content)) !== null) {
    const source = match[1];
    if (!seen.has(source)) {
      seen.add(source);
      imports.push({
        source,
        specifiers: [],
        isRelative: source.startsWith('.') || source.startsWith('/'),
      });
    }
  }

  return imports;
}

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

export function inferPurpose(filePath: string, exports: ExportInfo[]): string {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dir = path.dirname(filePath).toLowerCase();

  if (name.includes('test') || name.includes('spec')) return 'Test file';
  if (name.includes('config') || name.includes('rc')) return 'Configuration file';
  if (name === 'index') return 'Module entry point / barrel file';
  if (name === 'main' || name === 'app') return 'Application entry point';
  if (name.includes('route') || name.includes('router')) return 'Route definitions';
  if (name.includes('middleware')) return 'Middleware handler';
  if (name.includes('controller')) return 'Request controller';
  if (name.includes('service')) return 'Service layer logic';
  if (name.includes('model') || name.includes('schema')) return 'Data model / schema definition';
  if (name.includes('util') || name.includes('helper')) return 'Utility functions';
  if (name.includes('hook')) return 'Custom hook';
  if (name.includes('context') || name.includes('provider')) return 'Context / state provider';
  if (name.includes('type') || name.includes('interface')) return 'Type definitions';
  if (name.includes('constant')) return 'Constants / configuration';
  if (name.includes('migration')) return 'Database migration';
  if (name.includes('seed')) return 'Database seed data';
  if (name.includes('auth')) return 'Authentication logic';
  if (name.includes('api')) return 'API endpoint handler';

  if (dir.includes('component') || dir.includes('pages')) return 'UI component';
  if (dir.includes('service')) return 'Service module';
  if (dir.includes('model')) return 'Data model';
  if (dir.includes('util') || dir.includes('lib')) return 'Library / utility module';

  const exportTypes = exports.map((e) => e.type);
  if (exportTypes.includes('class')) return 'Class-based module';
  if (exportTypes.filter((t) => t === 'function').length > 2) return 'Function library';

  return 'Source module';
}

export function detectFileIssues(content: string, lineCount: number): string[] {
  const issues: string[] = [];

  if (lineCount > 500) issues.push(`Large file (${lineCount} lines) — consider splitting`);
  if (lineCount > 1000) issues.push('Very large file — strongly consider refactoring');

  if (/console\.(log|warn|error|debug)\s*\(/.test(content)) {
    issues.push('Contains console.log statements — consider using a proper logger');
  }

  if (/TODO|FIXME|HACK|XXX/i.test(content)) {
    issues.push('Contains TODO/FIXME comments');
  }

  if (/:\s*any\b/.test(content) && /\.tsx?$/.test(content)) {
    issues.push('Uses "any" type — consider using proper types');
  }

  return issues;
}
