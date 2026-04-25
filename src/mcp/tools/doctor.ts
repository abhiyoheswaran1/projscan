import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { calculateScore } from '../../utils/scoreCalculator.js';
import { PACKAGE_ARG_SCHEMA, resolvePackageFilter, type McpTool } from './_shared.js';

export const doctorTool: McpTool = {
  name: 'projscan_doctor',
  description:
    'Run a health check on the project. Returns a 0-100 score, letter grade, and the list of issues (linting, formatting, tests, security, architecture).',
  inputSchema: {
    type: 'object',
    properties: {
      package: PACKAGE_ARG_SCHEMA,
    },
  },
  handler: async (args, rootPath) => {
    const scan = await scanRepository(rootPath);
    let issues = await collectIssues(rootPath, scan.files);
    const passes = await resolvePackageFilter(rootPath, args);
    if (passes) {
      issues = issues.filter((i) => {
        const locs = i.locations ?? [];
        if (locs.length === 0) return false;
        return locs.some((l) => l.file && passes(l.file));
      });
    }
    const health = calculateScore(issues);
    return { health, issues };
  },
};
