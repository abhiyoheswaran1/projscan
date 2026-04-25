import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { computeCoupling, filterCoupling } from '../../core/couplingAnalyzer.js';
import { detectWorkspaces, filterFilesByPackage } from '../../core/monorepo.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { emitProgress } from '../progress.js';
import type { McpTool } from './_shared.js';

export const couplingTool: McpTool = {
  name: 'projscan_coupling',
  description:
    'Per-file coupling metrics (fan-in, fan-out, instability) and circular-import cycles, derived from the AST code graph. Use `direction` to focus the result: "all" returns every file sorted by fan-in; "high_fan_in" / "high_fan_out" sort accordingly; "cycles_only" returns just the files participating in import cycles. Cycles are reported separately as strongly-connected components of size >= 2.',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: "Optional. When set, the response includes only this file's coupling row (cycles list still returned in full).",
      },
      direction: {
        type: 'string',
        description: 'Filter/sort applied to `files`. Default "all".',
        enum: ['all', 'high_fan_in', 'high_fan_out', 'cycles_only'],
      },
      limit: { type: 'number', description: 'Max file rows returned (default 25, max 500).' },
      max_tokens: { type: 'number', description: 'Cap the response to roughly this many tokens.' },
      package: {
        type: 'string',
        description:
          'Optional. Workspace package name (from projscan_workspaces) to scope coupling rows to one package only.',
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
    const ws = await detectWorkspaces(rootPath);
    const report = computeCoupling(graph, ws);
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
      const ws2 = await detectWorkspaces(rootPath);
      const allowed = new Set(filterFilesByPackage(ws2, args.package, files.map((f) => f.relativePath)));
      files = files.filter((f) => allowed.has(f.relativePath));
    }
    files = files.slice(0, limit);
    emitProgress(2, 3, 'paginating');
    const page = paginate(files, readPageParams(args), listChecksum(files));
    emitProgress(3, 3, 'done');
    return {
      files: page.items,
      cycles: report.cycles,
      crossPackageEdges: report.crossPackageEdges,
      totalFiles: report.totalFiles,
      totalCycles: report.totalCycles,
      totalCrossPackageEdges: report.totalCrossPackageEdges,
      nextCursor: page.nextCursor,
      total: page.total,
    };
  },
};
