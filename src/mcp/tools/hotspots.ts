import { scanRepository } from '../../core/repositoryScanner.js';
import { collectIssues } from '../../core/issueEngine.js';
import { analyzeHotspots } from '../../core/hotspotAnalyzer.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { emitProgress } from '../progress.js';
import type { McpTool } from './_shared.js';

export const hotspotsTool: McpTool = {
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
      cursor: { type: 'string', description: 'Opaque cursor from a previous response. Omit for the first page.' },
      page_size: { type: 'number', description: 'Items per page (default 50, max 500).' },
      max_tokens: { type: 'number', description: 'Cap response to roughly this many tokens.' },
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
    const cached = await loadCachedGraph(rootPath);
    const graph = await buildCodeGraph(rootPath, scan.files, cached);
    await saveCachedGraph(rootPath, graph);
    emitProgress(3, 5, 'analyzing git churn + risk');
    const report = await analyzeHotspots(rootPath, scan.files, issues, { limit, since, graph });
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
};
