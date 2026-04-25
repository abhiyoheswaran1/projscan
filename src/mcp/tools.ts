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
import { computeCoupling, filterCoupling } from '../core/couplingAnalyzer.js';
import { computePrDiff } from '../core/prDiff.js';
import { detectWorkspaces, filterFilesByPackage } from '../core/monorepo.js';
import { buildSearchIndex, search as searchIndex, attachExcerpts, expandQuery } from '../core/searchIndex.js';
import {
  buildSemanticIndex,
  semanticSearch,
  reciprocalRankFusion,
} from '../core/semanticSearch.js';
import { isSemanticAvailable } from '../core/embeddings.js';
import { paginate, listChecksum, readPageParams } from './pagination.js';
import { emitProgress } from './progress.js';
import {
  inspectFile,
  extractImports,
  extractExports,
  inferPurpose,
  detectFileIssues,
} from '../core/fileInspector.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type { McpToolDefinition, AnalysisReport, FileExplanation, FileEntry } from '../types.js';

/**
 * A repo is "Python-dominated" if it has a pyproject.toml OR setup.py AND
 * either no node_modules directory or no package.json. Used by the upgrade
 * handler to short-circuit cleanly rather than return a confusing "not found"
 * for a package that would never live in node_modules to begin with.
 */
async function isPythonDominated(rootPath: string, files: FileEntry[]): Promise<boolean> {
  const hasPython = files.some((f) => f.extension === '.py' || f.extension === '.pyw');
  if (!hasPython) return false;
  const manifests = ['pyproject.toml', 'setup.py', 'setup.cfg'];
  let hasPyManifest = false;
  for (const m of manifests) {
    try {
      await fs.access(path.join(rootPath, m));
      hasPyManifest = true;
      break;
    } catch {
      // next
    }
  }
  if (!hasPyManifest) return false;
  try {
    await fs.access(path.join(rootPath, 'package.json'));
    return false; // has JS manifest, not Python-dominated
  } catch {
    return true;
  }
}

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
      emitProgress(0, 5, 'scanning repository');
      const scan = await scanRepository(rootPath);
      emitProgress(1, 5, 'detecting languages + frameworks');
      const languages = detectLanguages(scan.files);
      const frameworks = await detectFrameworks(rootPath, scan.files);
      emitProgress(2, 5, 'analyzing dependencies');
      const dependencies = await analyzeDependencies(rootPath);
      emitProgress(3, 5, 'running analyzers');
      const issues = await collectIssues(rootPath, scan.files);
      emitProgress(4, 5, 'scoring');
      const health = calculateScore(issues);
      emitProgress(5, 5, 'done');

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
      'Rank files by risk using git churn × AST cyclomatic complexity × open issues. Returns the most dangerous files to touch. Each hotspot includes `cyclomaticComplexity` (null for non-AST languages, where line count is used as fallback). Supports cursor-based pagination: pass the `nextCursor` from a previous response back as `cursor` to fetch the next page.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Cap on total hotspots ranked (default 100). For paging the returned set, use `page_size` + `cursor` instead.',
        },
        since: {
          type: 'string',
          description: 'Git history window. Examples: "12 months ago", "2024-01-01". Default: "12 months ago".',
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor from a previous response. Omit for the first page.',
        },
        page_size: {
          type: 'number',
          description: 'Items per page (default 50, max 500).',
        },
        max_tokens: {
          type: 'number',
          description: 'Cap response to roughly this many tokens.',
        },
        package: {
          type: 'string',
          description: 'Optional. Workspace package name (from projscan_workspaces) to scope hotspots to one package only.',
        },
      },
    },
    handler: async (args, rootPath) => {
      emitProgress(0, 5, 'scanning repository');
      const scan = await scanRepository(rootPath);
      emitProgress(1, 5, 'collecting issues');
      const issues = await collectIssues(rootPath, scan.files);
      const limit = typeof args.limit === 'number' ? args.limit : 100;
      const since = typeof args.since === 'string' ? args.since : undefined;
      emitProgress(2, 5, 'building code graph');
      // Graph powers AST cyclomatic complexity in the risk score (0.11).
      // Cache hit makes this nearly free on repeat runs.
      const cached = await loadCachedGraph(rootPath);
      const graph = await buildCodeGraph(rootPath, scan.files, cached);
      await saveCachedGraph(rootPath, graph);
      emitProgress(3, 5, 'analyzing git churn + risk');
      const report = await analyzeHotspots(rootPath, scan.files, issues, { limit, since, graph });
      // Optional --package scoping (0.13 monorepo).
      if (typeof args.package === 'string' && args.package.length > 0) {
        const ws = await detectWorkspaces(rootPath);
        const allowed = new Set(filterFilesByPackage(ws, args.package, report.hotspots.map((h) => h.relativePath)));
        report.hotspots = report.hotspots.filter((h) => allowed.has(h.relativePath));
      }
      emitProgress(4, 5, 'paginating');
      const page = paginate(report.hotspots, readPageParams(args), listChecksum(report.hotspots));
      emitProgress(5, 5, 'done');
      return {
        available: report.available,
        reason: report.reason,
        window: report.window,
        hotspots: page.items,
        totalFilesRanked: report.totalFilesRanked,
        nextCursor: page.nextCursor,
        total: page.total,
      };
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
      'Drill into a single file: purpose, imports, exports, churn/risk/ownership, related health issues, AST cyclomatic complexity, and coupling (fan-in / fan-out). Use this after projscan_hotspots when deciding how to approach a specific risky file.',
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
      'Compare declared vs installed versions of every package. Reports drift (patch/minor/major). Offline - does not hit the npm registry. Supports cursor pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: 'Opaque cursor from a previous response.' },
        page_size: { type: 'number', description: 'Items per page (default 50).' },
        max_tokens: { type: 'number', description: 'Cap response size.' },
      },
    },
    handler: async (args, rootPath) => {
      const report = await detectOutdated(rootPath);
      if (!report.available) return report;
      const page = paginate(report.packages, readPageParams(args), listChecksum(report.packages));
      return {
        available: true,
        totalPackages: report.totalPackages,
        packages: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
      };
    },
  },

  {
    name: 'projscan_audit',
    description:
      'Run `npm audit` and return a normalized summary of vulnerabilities (critical / high / moderate / low / info). Requires package-lock.json. Supports cursor pagination on the findings array.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: 'Opaque cursor from a previous response.' },
        page_size: { type: 'number', description: 'Items per page (default 50).' },
        max_tokens: { type: 'number', description: 'Cap response size.' },
      },
    },
    handler: async (args, rootPath) => {
      emitProgress(0, 2, 'running npm audit');
      const report = await runAudit(rootPath);
      if (!report.available) return report;
      emitProgress(1, 2, 'normalizing findings');
      const page = paginate(report.findings, readPageParams(args), listChecksum(report.findings));
      emitProgress(2, 2, 'done');
      return {
        available: true,
        summary: report.summary,
        findings: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
      };
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

      // Python-dominated repos have no node_modules CHANGELOG to slice.
      // Short-circuit with a clear reason rather than returning
      // available:false with a misleading "not found" message.
      if (await isPythonDominated(rootPath, scan.files)) {
        return {
          available: false,
          reason:
            'Upgrade preview is currently supported only for Node.js packages. Python support is planned for a future release.',
          name: pkgName,
          declared: null,
          installed: null,
          latest: null,
          drift: 'unknown',
          breakingMarkers: [],
          importers: [],
        };
      }

      return await previewUpgrade(rootPath, pkgName, scan.files);
    },
  },

  {
    name: 'projscan_coverage',
    description:
      'Join test coverage with hotspot risk. Returns files ranked by "risk × uncovered fraction" - the scariest untested files. Requires a coverage file at coverage/lcov.info, coverage/coverage-final.json, or coverage/coverage-summary.json.',
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
      const rawLimit = typeof args.limit === 'number' ? args.limit : 200;
      const limit = Math.max(1, Math.min(500, rawLimit));
      const hotspots = await analyzeHotspots(rootPath, scan.files, issues, {
        limit,
        coverage: coverage.available ? coverageMap(coverage) : undefined,
      });
      const joined = joinCoverageWithHotspots(hotspots, coverage);
      if (!joined.available) return joined;
      const page = paginate(joined.entries, readPageParams(args), listChecksum(joined.entries));
      return {
        available: true,
        coverageSource: joined.coverageSource,
        coverageSourceFile: joined.coverageSourceFile,
        entries: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
      };
    },
  },

  {
    name: 'projscan_graph',
    description:
      'Query the AST-based code graph directly. Returns imports, exports, importers, or symbol definitions for a file or symbol. Agents should prefer this over analyze/doctor/explain for targeted structural questions - it is much cheaper and more accurate.',
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
    name: 'projscan_coupling',
    description:
      'Per-file coupling metrics (fan-in, fan-out, instability) and circular-import cycles, derived from the AST code graph. Use `direction` to focus the result: "all" returns every file sorted by fan-in; "high_fan_in" / "high_fan_out" sort accordingly; "cycles_only" returns just the files participating in import cycles. Cycles are reported separately as strongly-connected components of size >= 2.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Optional. When set, the response includes only this file\'s coupling row (cycles list still returned in full).',
        },
        direction: {
          type: 'string',
          description: 'Filter/sort applied to `files`. Default "all".',
          enum: ['all', 'high_fan_in', 'high_fan_out', 'cycles_only'],
        },
        limit: {
          type: 'number',
          description: 'Max file rows returned (default 25, max 500).',
        },
        max_tokens: {
          type: 'number',
          description: 'Cap the response to roughly this many tokens.',
        },
        package: {
          type: 'string',
          description: 'Optional. Workspace package name (from projscan_workspaces) to scope coupling rows to one package only.',
        },
      },
    },
    handler: async (args, rootPath) => {
      emitProgress(0, 3, 'building code graph');
      const scan = await scanRepository(rootPath);
      const cached = await loadCachedGraph(rootPath);
      const graph = await buildCodeGraph(rootPath, scan.files, cached);
      await saveCachedGraph(rootPath, graph);
      emitProgress(1, 3, 'computing coupling + cycles');
      const report = computeCoupling(graph);
      const direction = (typeof args.direction === 'string' ? args.direction : 'all') as
        | 'all'
        | 'high_fan_in'
        | 'high_fan_out'
        | 'cycles_only';
      const limit = Math.max(1, Math.min(500, typeof args.limit === 'number' ? args.limit : 25));
      const file = typeof args.file === 'string' ? args.file : undefined;

      let files = filterCoupling(report, direction);
      if (file) files = files.filter((f) => f.relativePath === file);
      if (typeof args.package === 'string' && args.package.length > 0) {
        const ws = await detectWorkspaces(rootPath);
        const allowed = new Set(filterFilesByPackage(ws, args.package, files.map((f) => f.relativePath)));
        files = files.filter((f) => allowed.has(f.relativePath));
      }
      files = files.slice(0, limit);
      emitProgress(2, 3, 'paginating');
      const page = paginate(files, readPageParams(args), listChecksum(files));
      emitProgress(3, 3, 'done');
      return {
        files: page.items,
        cycles: report.cycles,
        totalFiles: report.totalFiles,
        totalCycles: report.totalCycles,
        nextCursor: page.nextCursor,
        total: page.total,
      };
    },
  },

  {
    name: 'projscan_workspaces',
    description:
      'List monorepo workspace packages (npm/yarn workspaces, pnpm-workspace.yaml, Nx/Turbo/Lerna fallback). Returns one row per package with name, relative path, and version. Use the package `name` as the `package` argument on projscan_hotspots / projscan_coupling to scope those tools to a single package.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async (_args, rootPath) => {
      return await detectWorkspaces(rootPath);
    },
  },

  {
    name: 'projscan_pr_diff',
    description:
      'Structural (AST) diff between two refs — what changed in exports, imports, call sites, cyclomatic complexity, and fan-in. Not a text diff: this surfaces the symbols and edges that an agent reviewing a PR actually cares about. Defaults: base=origin/main (falls back to main/master/HEAD~1), head=HEAD. Spins up a throwaway git worktree at the base ref to get a clean second graph.',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: 'Base ref (branch, tag, sha). Default: origin/main, falling back to main/master/HEAD~1.',
        },
        head: {
          type: 'string',
          description: 'Head ref. Default: HEAD.',
        },
        max_tokens: {
          type: 'number',
          description: 'Cap the response to roughly this many tokens.',
        },
      },
    },
    handler: async (args, rootPath) => {
      emitProgress(0, 3, 'resolving refs');
      const base = typeof args.base === 'string' ? args.base : undefined;
      const head = typeof args.head === 'string' ? args.head : undefined;
      emitProgress(1, 3, 'building base + head graphs');
      const report = await computePrDiff(rootPath, { base, head });
      emitProgress(2, 3, 'diffing');
      emitProgress(3, 3, 'done');
      return report;
    },
  },

  {
    name: 'projscan_search',
    description:
      'Ranked search across the project. Lexical (BM25) by default; optional semantic (vector) and hybrid (RRF fusion) modes available when the @xenova/transformers peer dependency is installed. Scope controls what to search: "auto"/"content" (ranked content matches with excerpts), "symbols" (exported names), "files" (path substring).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string. Multi-word queries are treated as OR across BM25 terms; semantic mode embeds the full query.',
        },
        scope: {
          type: 'string',
          description: 'What to search over: "auto" (= content), "symbols", "files", "content".',
          enum: ['auto', 'symbols', 'files', 'content'],
        },
        mode: {
          type: 'string',
          description: '"lexical" (default, BM25) | "semantic" (embeddings, requires peer dep) | "hybrid" (BM25 + semantic via reciprocal rank fusion). Ignored for "symbols" and "files" scopes.',
          enum: ['lexical', 'semantic', 'hybrid'],
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
      required: ['query'],
    },
    handler: async (args, rootPath) => {
      const query = String(args.query ?? '').trim();
      if (!query) throw new Error('query argument is required and must be non-empty');
      const scope = String(args.scope ?? 'auto');
      const limit = Math.max(1, Math.min(500, typeof args.limit === 'number' ? args.limit : 30));

      const scan = await scanRepository(rootPath);
      const cached = await loadCachedGraph(rootPath);
      const graph = await buildCodeGraph(rootPath, scan.files, cached);
      await saveCachedGraph(rootPath, graph);

      // Files scope - simple substring scan; ranking adds no value
      if (scope === 'files') {
        const q = query.toLowerCase();
        const all = scan.files
          .filter((f) => f.relativePath.toLowerCase().includes(q))
          .map((f) => ({ file: f.relativePath, sizeBytes: f.sizeBytes }));
        const page = paginate(all, readPageParams(args), listChecksum(all));
        return { scope, query, matches: page.items, total: page.total, nextCursor: page.nextCursor };
      }

      // Symbols scope - walk the graph's export table; rank exact/prefix/substring
      if (scope === 'symbols') {
        const q = query.toLowerCase();
        const rawMatches: Array<{ symbol: string; kind: string; file: string; line: number; rank: number }> = [];
        for (const [file, entry] of graph.files) {
          for (const exp of entry.exports) {
            const name = exp.name.toLowerCase();
            if (!name.includes(q)) continue;
            const rank = name === q ? 0 : name.startsWith(q) ? 1 : 2;
            rawMatches.push({ symbol: exp.name, kind: exp.kind, file, line: exp.line, rank });
          }
        }
        rawMatches.sort((a, b) => a.rank - b.rank);
        const cleaned = rawMatches.map((m) => ({
          symbol: m.symbol,
          kind: m.kind,
          file: m.file,
          line: m.line,
        }));
        const page = paginate(cleaned, readPageParams(args), listChecksum(cleaned));
        return { scope, query, matches: page.items, total: page.total, nextCursor: page.nextCursor };
      }

      // Content or auto scope - lexical BM25 by default, optionally semantic or hybrid
      const mode = String(args.mode ?? 'lexical');
      const index = await buildSearchIndex(rootPath, scan.files, graph);
      const lexicalHits = searchIndex(index, query, { limit });
      const tokens = expandQuery(query);

      if (mode === 'lexical') {
        const withExcerpts = await attachExcerpts(rootPath, lexicalHits, tokens);
        const page = paginate(withExcerpts, readPageParams(args), listChecksum(withExcerpts));
        return {
          scope: scope === 'auto' ? 'content' : scope,
          mode: 'lexical',
          query,
          queryTokens: tokens,
          matches: page.items,
          total: page.total,
          nextCursor: page.nextCursor,
        };
      }

      // Semantic or hybrid - both require the peer
      const hasSemantic = await isSemanticAvailable();
      if (!hasSemantic) {
        return {
          scope: scope === 'auto' ? 'content' : scope,
          mode,
          query,
          error:
            'Semantic search requires the optional peer dependency @xenova/transformers. Install it with: npm install @xenova/transformers',
          available: false,
          matches: [],
          total: 0,
        };
      }

      const semIndex = await buildSemanticIndex(rootPath, scan.files);
      if (!semIndex) {
        return {
          scope: scope === 'auto' ? 'content' : scope,
          mode,
          query,
          error: 'Semantic index build failed (peer loaded but model not usable).',
          available: false,
          matches: [],
          total: 0,
        };
      }

      const semHits = await semanticSearch(semIndex, query, { limit });

      if (mode === 'semantic') {
        const enriched = await attachExcerpts(
          rootPath,
          semHits.map((h) => ({
            file: h.file,
            score: h.score,
            matched: [],
            symbolMatch: false,
            pathMatch: false,
            excerpt: '',
            line: 0,
          })),
          tokens,
        );
        const page = paginate(enriched, readPageParams(args), listChecksum(enriched));
        return {
          scope: scope === 'auto' ? 'content' : scope,
          mode: 'semantic',
          query,
          model: semIndex.model,
          matches: page.items,
          total: page.total,
          nextCursor: page.nextCursor,
        };
      }

      // Hybrid - reciprocal rank fusion
      const fused = reciprocalRankFusion([lexicalHits, semHits]).slice(0, limit);
      const enriched = await attachExcerpts(
        rootPath,
        fused.map((f) => ({
          file: f.file,
          score: f.score,
          matched: [],
          symbolMatch: false,
          pathMatch: false,
          excerpt: '',
          line: 0,
        })),
        tokens,
      );
      const page = paginate(enriched, readPageParams(args), listChecksum(enriched));
      return {
        scope: scope === 'auto' ? 'content' : scope,
        mode: 'hybrid',
        query,
        queryTokens: tokens,
        model: semIndex.model,
        matches: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
      };
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
