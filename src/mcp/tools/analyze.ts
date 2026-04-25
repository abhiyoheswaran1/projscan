import path from 'node:path';
import { scanRepository } from '../../core/repositoryScanner.js';
import { detectLanguages } from '../../core/languageDetector.js';
import { detectFrameworks } from '../../core/frameworkDetector.js';
import { analyzeDependencies } from '../../core/dependencyAnalyzer.js';
import { collectIssues } from '../../core/issueEngine.js';
import { calculateScore } from '../../utils/scoreCalculator.js';
import { emitProgress } from '../progress.js';
import { PACKAGE_ARG_SCHEMA, resolvePackageFilter, type McpTool } from './_shared.js';
import type { AnalysisReport } from '../../types.js';

export const analyzeTool: McpTool = {
  name: 'projscan_analyze',
  description:
    'Run a full projscan analysis of the project: languages, frameworks, dependencies, issues, and health score. Use this to understand a codebase before making changes.',
  inputSchema: {
    type: 'object',
    properties: {
      package: PACKAGE_ARG_SCHEMA,
    },
  },
  handler: async (args, rootPath) => {
    emitProgress(0, 5, 'scanning repository');
    const scan = await scanRepository(rootPath);
    emitProgress(1, 5, 'detecting languages + frameworks');
    const languages = detectLanguages(scan.files);
    const frameworks = await detectFrameworks(rootPath, scan.files);
    emitProgress(2, 5, 'analyzing dependencies');
    const dependencies = await analyzeDependencies(rootPath);
    emitProgress(3, 5, 'running analyzers');
    let issues = await collectIssues(rootPath, scan.files);
    const passes = await resolvePackageFilter(rootPath, args);
    if (passes) {
      issues = issues.filter((i) => {
        const locs = i.locations ?? [];
        if (locs.length === 0) return false;
        return locs.some((l) => l.file && passes(l.file));
      });
    }
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
};
