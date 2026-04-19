import path from 'node:path';
import fs from 'node:fs/promises';
import { scanRepository } from '../core/repositoryScanner.js';
import { detectLanguages } from '../core/languageDetector.js';
import { detectFrameworks } from '../core/frameworkDetector.js';
import { analyzeDependencies } from '../core/dependencyAnalyzer.js';
import { collectIssues } from '../core/issueEngine.js';
import { analyzeHotspots } from '../core/hotspotAnalyzer.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type {
  McpToolDefinition,
  AnalysisReport,
  FileExplanation,
  ImportInfo,
  ExportInfo,
} from '../types.js';

export interface McpToolHandler {
  (args: Record<string, unknown>, rootPath: string): Promise<unknown>;
}

export interface McpTool extends McpToolDefinition {
  handler: McpToolHandler;
}

const tools: McpTool[] = [
  {
    name: 'projscan_analyze',
    description:
      'Run a full projscan analysis of the project: languages, frameworks, dependencies, issues, and health score. Use this to understand a codebase before making changes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      const scan = await scanRepository(rootPath);
      const languages = detectLanguages(scan.files);
      const frameworks = await detectFrameworks(rootPath, scan.files);
      const dependencies = await analyzeDependencies(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const health = calculateScore(issues);

      const report: AnalysisReport & { health: typeof health } = {
        projectName: path.basename(rootPath),
        rootPath,
        scan: { ...scan, files: [], directoryTree: scan.directoryTree },
        languages,
        frameworks,
        dependencies,
        issues,
        timestamp: new Date().toISOString(),
        health,
      };
      return report;
    },
  },

  {
    name: 'projscan_doctor',
    description:
      'Run a health check on the project. Returns a 0-100 score, letter grade, and the list of issues (linting, formatting, tests, security, architecture).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const health = calculateScore(issues);
      return {
        health,
        issues,
      };
    },
  },

  {
    name: 'projscan_hotspots',
    description:
      'Rank files by risk using git churn × complexity × open issues. Returns the most dangerous files to touch. Use this to decide where to focus refactoring, testing, or review effort.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'How many hotspots to return (default: 10, max: 100).',
        },
        since: {
          type: 'string',
          description: 'Git history window. Examples: "12 months ago", "2024-01-01". Default: "12 months ago".',
        },
      },
    },
    handler: async (args, rootPath) => {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const limit = typeof args.limit === 'number' ? args.limit : undefined;
      const since = typeof args.since === 'string' ? args.since : undefined;
      return await analyzeHotspots(rootPath, scan.files, issues, { limit, since });
    },
  },

  {
    name: 'projscan_explain',
    description:
      'Explain a single file: purpose, imports, exports, and potential issues. Useful for understanding unfamiliar code before editing.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Path to the file relative to the project root.',
        },
      },
      required: ['file'],
    },
    handler: async (args, rootPath) => {
      const rel = typeof args.file === 'string' ? args.file : '';
      if (!rel) throw new Error('file argument is required');

      const absolutePath = path.resolve(rootPath, rel);
      const resolvedRoot = path.resolve(rootPath);
      if (!absolutePath.startsWith(resolvedRoot + path.sep) && absolutePath !== resolvedRoot) {
        throw new Error('file must be inside the project root');
      }

      const content = await fs.readFile(absolutePath, 'utf-8');
      return explainFile(absolutePath, content, rootPath);
    },
  },

  {
    name: 'projscan_structure',
    description: 'Return the project directory tree with file counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      const scan = await scanRepository(rootPath);
      return { structure: scan.directoryTree, totalFiles: scan.totalFiles };
    },
  },

  {
    name: 'projscan_dependencies',
    description: 'Analyze package.json dependencies and return counts and risks (deprecated packages, wildcard versions, etc.).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      const report = await analyzeDependencies(rootPath);
      if (!report) return { available: false, reason: 'No package.json found' };
      return { available: true, ...report };
    },
  },
];

export function getToolDefinitions(): McpToolDefinition[] {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export function getToolHandler(name: string): McpToolHandler | undefined {
  return tools.find((t) => t.name === name)?.handler;
}

// ── File Explanation (mirrors the logic in cli/index.ts) ──

function explainFile(absolutePath: string, content: string, rootPath: string): FileExplanation {
  const lines = content.split('\n');
  const imports = extractImports(content);
  const exports = extractExports(content);
  const purpose = inferPurpose(absolutePath, imports, exports);
  const potentialIssues = detectFileIssues(content, lines.length);

  return {
    filePath: path.relative(rootPath, absolutePath),
    purpose,
    imports,
    exports,
    potentialIssues,
    lineCount: lines.length,
  };
}

function extractImports(content: string): ImportInfo[] {
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

function extractExports(content: string): ExportInfo[] {
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

function inferPurpose(filePath: string, _imports: ImportInfo[], exports: ExportInfo[]): string {
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
  if (name.includes('auth')) return 'Authentication logic';
  if (name.includes('api')) return 'API endpoint handler';

  if (dir.includes('component') || dir.includes('pages')) return 'UI component';
  if (dir.includes('service')) return 'Service module';
  if (dir.includes('util') || dir.includes('lib')) return 'Library / utility module';

  const exportTypes = exports.map((e) => e.type);
  if (exportTypes.includes('class')) return 'Class-based module';
  if (exportTypes.filter((t) => t === 'function').length > 2) return 'Function library';

  return 'Source module';
}

function detectFileIssues(content: string, lineCount: number): string[] {
  const issues: string[] = [];

  if (lineCount > 500) issues.push(`Large file (${lineCount} lines) — consider splitting`);
  if (lineCount > 1000) issues.push('Very large file — strongly consider refactoring');

  if (/console\.(log|warn|error|debug)\s*\(/.test(content)) {
    issues.push('Contains console.log statements — consider using a proper logger');
  }

  if (/TODO|FIXME|HACK|XXX/i.test(content)) {
    issues.push('Contains TODO/FIXME comments');
  }

  return issues;
}
