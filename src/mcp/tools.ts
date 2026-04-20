import path from 'node:path';
import fs from 'node:fs/promises';
import { scanRepository } from '../core/repositoryScanner.js';
import { detectLanguages } from '../core/languageDetector.js';
import { detectFrameworks } from '../core/frameworkDetector.js';
import { analyzeDependencies } from '../core/dependencyAnalyzer.js';
import { collectIssues } from '../core/issueEngine.js';
import { analyzeHotspots } from '../core/hotspotAnalyzer.js';
import { detectOutdated } from '../core/outdatedDetector.js';
import { runAudit } from '../core/auditRunner.js';
import { previewUpgrade } from '../core/upgradePreview.js';
import { parseCoverage, coverageMap } from '../core/coverageParser.js';
import { joinCoverageWithHotspots } from '../core/coverageJoin.js';
import {
  buildCodeGraph,
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
} from '../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../core/indexCache.js';
import {
  inspectFile,
  extractImports,
  extractExports,
  inferPurpose,
  detectFileIssues,
} from '../core/fileInspector.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type { McpToolDefinition, AnalysisReport, FileExplanation } from '../types.js';

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
    name: 'projscan_file',
    description:
      'Drill into a single file: purpose, imports, exports, AND its churn/risk/ownership plus any related health issues. Use this after projscan_hotspots when deciding how to approach a specific risky file.',
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
      return await inspectFile(rootPath, rel);
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

  {
    name: 'projscan_outdated',
    description:
      'Compare declared vs installed versions of every package. Reports drift (patch/minor/major). Offline — does not hit the npm registry.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      return await detectOutdated(rootPath);
    },
  },

  {
    name: 'projscan_audit',
    description:
      'Run `npm audit` and return a normalized summary of vulnerabilities (critical / high / moderate / low / info). Requires package-lock.json.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      return await runAudit(rootPath);
    },
  },

  {
    name: 'projscan_upgrade',
    description:
      'Preview the impact of upgrading a package: semver drift, breaking-change markers from the local CHANGELOG, and the files in your repo that import it. Offline.',
    inputSchema: {
      type: 'object',
      properties: {
        package: {
          type: 'string',
          description: 'Name of the package to preview.',
        },
      },
      required: ['package'],
    },
    handler: async (args, rootPath) => {
      const pkgName = typeof args.package === 'string' ? args.package : '';
      if (!pkgName) throw new Error('package argument is required');
      const scan = await scanRepository(rootPath);
      return await previewUpgrade(rootPath, pkgName, scan.files);
    },
  },

  {
    name: 'projscan_coverage',
    description:
      'Join test coverage with hotspot risk. Returns files ranked by "risk × uncovered fraction" — the scariest untested files. Requires a coverage file at coverage/lcov.info, coverage/coverage-final.json, or coverage/coverage-summary.json.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'How many entries to return (default: 30, max: 200).',
        },
        max_tokens: {
          type: 'number',
          description: 'Cap the response size to roughly this many tokens (~4 chars/token). Truncates the entries array to fit.',
        },
      },
    },
    handler: async (args, rootPath) => {
      const coverage = await parseCoverage(rootPath);
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const rawLimit = typeof args.limit === 'number' ? args.limit : 30;
      const limit = Math.max(1, Math.min(200, rawLimit));
      const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
        limit,
        coverage: coverage.available ? coverageMap(coverage) : undefined,
      });
      return joinCoverageWithHotspots(hotspots, coverage);
    },
  },

  {
    name: 'projscan_graph',
    description:
      'Query the AST-based code graph directly. Returns imports, exports, importers, or symbol definitions for a file or symbol. Agents should prefer this over analyze/doctor/explain for targeted structural questions — it is much cheaper and more accurate.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'File path (relative to project root) to query.',
        },
        symbol: {
          type: 'string',
          description: 'Symbol name to query (e.g. a function or class). Use instead of `file` to find where a symbol is defined.',
        },
        direction: {
          type: 'string',
          description: 'What to return: "imports" (what the file imports), "exports" (what the file exports), "importers" (who imports the file), "symbol_defs" (files defining the symbol), "package_importers" (files importing a package by name).',
          enum: ['imports', 'exports', 'importers', 'symbol_defs', 'package_importers'],
        },
        limit: {
          type: 'number',
          description: 'Max entries returned (default 50).',
        },
        max_tokens: {
          type: 'number',
          description: 'Cap the response to roughly this many tokens.',
        },
      },
      required: ['direction'],
    },
    handler: async (args, rootPath) => {
      const scan = await scanRepository(rootPath);
      const cached = await loadCachedGraph(rootPath);
      const graph = await buildCodeGraph(rootPath, scan.files, cached);
      await saveCachedGraph(rootPath, graph);

      const direction = String(args.direction);
      const file = typeof args.file === 'string' ? args.file : undefined;
      const symbol = typeof args.symbol === 'string' ? args.symbol : undefined;
      const limit = Math.max(1, Math.min(500, typeof args.limit === 'number' ? args.limit : 50));

      switch (direction) {
        case 'imports': {
          if (!file) throw new Error('file argument is required for direction=imports');
          return { file, imports: importsOf(graph, file).slice(0, limit) };
        }
        case 'exports': {
          if (!file) throw new Error('file argument is required for direction=exports');
          return { file, exports: exportsOf(graph, file).slice(0, limit) };
        }
        case 'importers': {
          if (!file) throw new Error('file argument is required for direction=importers');
          return { file, importers: filesImportingFile(graph, file).slice(0, limit) };
        }
        case 'symbol_defs': {
          if (!symbol) throw new Error('symbol argument is required for direction=symbol_defs');
          return { symbol, definedIn: filesDefiningSymbol(graph, symbol).slice(0, limit) };
        }
        case 'package_importers': {
          const pkg = symbol ?? file;
          if (!pkg) throw new Error('symbol (or file) argument is required for direction=package_importers');
          return { package: pkg, importers: filesImportingPackage(graph, pkg).slice(0, limit) };
        }
        default:
          throw new Error(`unknown direction: ${direction}`);
      }
    },
  },

  {
    name: 'projscan_search',
    description:
      'Fast structural search across the project. Scope can be "symbols" (exported function/class/type names), "files" (relative path substring), or "content" (text substring in source files). Returns a ranked list of matches. Prefer this over running shell grep.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string (case-insensitive for files/content; exact-ish for symbols).',
        },
        scope: {
          type: 'string',
          description: 'What to search over: "symbols" | "files" | "content".',
          enum: ['symbols', 'files', 'content'],
        },
        limit: {
          type: 'number',
          description: 'Max matches returned (default 30).',
        },
        max_tokens: {
          type: 'number',
          description: 'Cap the response to roughly this many tokens.',
        },
      },
      required: ['query', 'scope'],
    },
    handler: async (args, rootPath) => {
      const query = String(args.query ?? '').trim();
      if (!query) throw new Error('query argument is required and must be non-empty');
      const scope = String(args.scope ?? 'symbols');
      const limit = Math.max(1, Math.min(500, typeof args.limit === 'number' ? args.limit : 30));

      const scan = await scanRepository(rootPath);
      const cached = await loadCachedGraph(rootPath);
      const graph = await buildCodeGraph(rootPath, scan.files, cached);
      await saveCachedGraph(rootPath, graph);

      if (scope === 'files') {
        const q = query.toLowerCase();
        const matches = scan.files
          .filter((f) => f.relativePath.toLowerCase().includes(q))
          .slice(0, limit)
          .map((f) => ({ file: f.relativePath, sizeBytes: f.sizeBytes }));
        return { scope, query, matches, total: matches.length };
      }

      if (scope === 'symbols') {
        const q = query.toLowerCase();
        const matches: Array<{ symbol: string; kind: string; file: string; line: number }> = [];
        for (const [file, entry] of graph.files) {
          for (const exp of entry.exports) {
            if (exp.name.toLowerCase().includes(q)) {
              matches.push({ symbol: exp.name, kind: exp.kind, file, line: exp.line });
            }
          }
          if (matches.length >= limit * 3) break;
        }
        matches.sort((a, b) => {
          const aExact = a.symbol.toLowerCase() === query.toLowerCase() ? 0 : 1;
          const bExact = b.symbol.toLowerCase() === query.toLowerCase() ? 0 : 1;
          return aExact - bExact;
        });
        return { scope, query, matches: matches.slice(0, limit), total: matches.length };
      }

      // content scope: scan parseable files for substring, return file + first 3 lines of context
      const q = query.toLowerCase();
      const matches: Array<{ file: string; line: number; excerpt: string }> = [];
      for (const file of scan.files) {
        if (!graph.files.has(file.relativePath)) continue;
        if (file.sizeBytes > 512 * 1024) continue;
        if (matches.length >= limit) break;
        try {
          const content = await fs.readFile(
            path.isAbsolute(file.absolutePath) ? file.absolutePath : path.resolve(rootPath, file.relativePath),
            'utf-8',
          );
          const lower = content.toLowerCase();
          const idx = lower.indexOf(q);
          if (idx === -1) continue;
          const before = content.slice(0, idx);
          const line = before.split('\n').length;
          const lineStart = before.lastIndexOf('\n') + 1;
          const lineEnd = content.indexOf('\n', idx);
          const excerpt = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim().slice(0, 200);
          matches.push({ file: file.relativePath, line, excerpt });
        } catch {
          // unreadable; skip
        }
      }
      return { scope, query, matches, total: matches.length };
    },
  },
];

export function getToolDefinitions(): McpToolDefinition[] {
  return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export function getToolHandler(name: string): McpToolHandler | undefined {
  return tools.find((t) => t.name === name)?.handler;
}

// ── File Explanation (used by projscan_explain) ──────────

function explainFile(absolutePath: string, content: string, rootPath: string): FileExplanation {
  const lines = content.split('\n');
  const imports = extractImports(content);
  const exports = extractExports(content);
  const purpose = inferPurpose(absolutePath, exports);
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
