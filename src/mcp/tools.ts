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
