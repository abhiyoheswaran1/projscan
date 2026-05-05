import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import { computeImpact } from '../../core/impact.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { emitProgress } from '../progress.js';
import type { McpTool } from './_shared.js';

export const impactTool: McpTool = {
  name: 'projscan_impact',
  description:
    'Transitive blast-radius analysis. Given a `file` (repo-relative path), returns every file that transitively imports it, ranked by BFS distance (1 = direct importer). Given a `symbol` (export name), returns the symbol\'s definition file(s), the files that directly call it, and their transitive importers. Use this BEFORE renaming or deleting to see what breaks. Cycle-safe; depth-bounded by `max_distance` (default 10).',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'Repo-relative file path. Mutually exclusive with `symbol`.',
      },
      symbol: {
        type: 'string',
        description: 'Symbol (export) name. Mutually exclusive with `file`.',
      },
      max_distance: {
        type: 'number',
        description: 'Maximum BFS hops from the target. Default 10. Reports `truncated: true` when exceeded.',
      },
      cursor: { type: 'string', description: 'Opaque cursor from a previous response.' },
      page_size: { type: 'number', description: 'Items per page (default 50, max 500).' },
      max_tokens: { type: 'number', description: 'Cap response to roughly this many tokens.' },
    },
  },
  handler: async (args, rootPath) => {
    const file = typeof args.file === 'string' && args.file.length > 0 ? args.file : null;
    const symbol = typeof args.symbol === 'string' && args.symbol.length > 0 ? args.symbol : null;
    if (!file && !symbol) {
      throw new Error(
        'projscan_impact needs exactly one of `file` (a repo-relative path) or `symbol` (an exported name). Pass `file` for "what files transitively import this?" and `symbol` for "what calls this exported name?"',
      );
    }
    if (file && symbol) {
      throw new Error(
        '`file` and `symbol` are mutually exclusive — pass exactly one. Use `file` for file-level blast radius, `symbol` for symbol-level callers.',
      );
    }
    const maxDistance = typeof args.max_distance === 'number' ? args.max_distance : undefined;

    emitProgress(0, 3, 'scanning repository');
    const scan = await scanRepository(rootPath);
    emitProgress(1, 3, 'building code graph');
    const cached = await loadCachedGraph(rootPath);
    const graph = await buildCodeGraph(rootPath, scan.files, cached);
    await saveCachedGraph(rootPath, graph);

    emitProgress(2, 3, 'computing impact');
    const target = file ? { kind: 'file' as const, value: file } : { kind: 'symbol' as const, value: symbol! };
    const report = computeImpact(graph, target, maxDistance !== undefined ? { maxDistance } : {});
    const page = paginate(report.reachable, readPageParams(args), listChecksum(report.reachable));
    emitProgress(3, 3, 'done');
    return {
      ...report,
      reachable: page.items,
      total: page.total,
      nextCursor: page.nextCursor,
    };
  },
};
