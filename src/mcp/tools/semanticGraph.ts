import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { buildSemanticGraph } from '../../core/semanticGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import type { McpTool } from './_shared.js';

export const semanticGraphTool: McpTool = {
  name: 'projscan_semantic_graph',
  description:
    'Return the stable v3 semantic graph: file/function/package/symbol nodes plus imports, exports, defines, and calls edges. Use when an agent needs one normalized graph contract instead of several targeted graph queries.',
  inputSchema: {
    type: 'object',
    properties: {
      max_nodes: {
        type: 'number',
        description: 'Maximum graph nodes to return. Default 10000.',
      },
      max_edges: {
        type: 'number',
        description: 'Maximum graph edges to return. Default 25000.',
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
