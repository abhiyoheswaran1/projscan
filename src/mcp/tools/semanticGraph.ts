import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { buildSemanticGraph } from '../../core/semanticGraph.js';
import { runGraphQuery, type GraphQueryDirection } from '../../core/graphQuery.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import type { McpTool } from './_shared.js';

export const semanticGraphTool: McpTool = {
  name: 'projscan_semantic_graph',
  description:
    'The code graph, two ways. With no `query`: returns the stable v3 semantic graph (file/function/package/symbol nodes plus imports, exports, defines, and calls edges). With `query`: answers one cheap, targeted question instead of serializing the whole graph — who imports a file, what a file imports/exports, where a symbol is defined, or which files import a package. (The targeted mode subsumes the former projscan_graph tool, removed in 4.0.)',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'object',
        description: 'Optional. Ask one targeted question instead of returning the whole graph.',
        properties: {
          direction: {
            type: 'string',
            enum: ['imports', 'exports', 'importers', 'symbol_defs', 'package_importers'],
            description:
              '"imports" (what the file imports), "exports" (what the file exports), "importers" (who imports the file), "symbol_defs" (files defining the symbol), "package_importers" (files importing a package by name).',
          },
          file: {
            type: 'string',
            description: 'Repo-relative file path (for imports/exports/importers).',
          },
          symbol: {
            type: 'string',
            description: 'Symbol or package name (for symbol_defs/package_importers).',
          },
          limit: { type: 'number', description: 'Max entries returned (default 50, max 500).' },
        },
        required: ['direction'],
      },
      max_nodes: {
        type: 'number',
        description: 'Full-graph mode only. Maximum graph nodes to return. Default 10000.',
      },
      max_edges: {
        type: 'number',
        description: 'Full-graph mode only. Maximum graph edges to return. Default 25000.',
      },
      max_tokens: {
        type: 'number',
        description: 'Cap the response to roughly this many tokens.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const scan = await scanRepository(rootPath);
    const cached = await loadCachedGraph(rootPath);
    const graph = await buildCodeGraph(rootPath, scan.files, cached);
    await saveCachedGraph(rootPath, graph);

    const query = args.query as
      | { direction?: unknown; file?: unknown; symbol?: unknown; limit?: unknown }
      | undefined;
    if (query && typeof query.direction === 'string') {
      return runGraphQuery(graph, {
        direction: query.direction as GraphQueryDirection,
        file: typeof query.file === 'string' ? query.file : undefined,
        symbol: typeof query.symbol === 'string' ? query.symbol : undefined,
        limit: typeof query.limit === 'number' ? query.limit : undefined,
      });
    }

    return buildSemanticGraph(graph, {
      maxNodes:
        typeof args.max_nodes === 'number' && Number.isFinite(args.max_nodes)
          ? args.max_nodes
          : undefined,
      maxEdges:
        typeof args.max_edges === 'number' && Number.isFinite(args.max_edges)
          ? args.max_edges
          : undefined,
    });
  },
};
