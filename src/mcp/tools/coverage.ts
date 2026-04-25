import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { analyzeHotspots } from '../../core/hotspotAnalyzer.js';
import { parseCoverage, coverageMap } from '../../core/coverageParser.js';
import { joinCoverageWithHotspots } from '../../core/coverageJoin.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { PACKAGE_ARG_SCHEMA, resolvePackageFilter, type McpTool } from './_shared.js';

export const coverageTool: McpTool = {
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
      package: PACKAGE_ARG_SCHEMA,
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
    const passes = await resolvePackageFilter(rootPath, args);
    const filteredEntries = passes
      ? joined.entries.filter((e) => passes(e.relativePath))
      : joined.entries;
    const page = paginate(filteredEntries, readPageParams(args), listChecksum(filteredEntries));
    return {
      available: true,
      coverageSource: joined.coverageSource,
      coverageSourceFile: joined.coverageSourceFile,
      entries: page.items,
      total: page.total,
      nextCursor: page.nextCursor,
    };
  },
};
