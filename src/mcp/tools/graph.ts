import { scanRepository } from '../../core/repositoryScanner.js';
import {
  buildCodeGraph,
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
} from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import type { McpTool } from './_shared.js';

export const graphTool: McpTool = {
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
        description:
          'What to return: "imports" (what the file imports), "exports" (what the file exports), "importers" (who imports the file), "symbol_defs" (files defining the symbol), "package_importers" (files importing a package by name).',
        enum: ['imports', 'exports', 'importers', 'symbol_defs', 'package_importers'],
      },
      limit: { type: 'number', description: 'Max entries returned (default 50).' },
      max_tokens: { type: 'number', description: 'Cap the response to roughly this many tokens.' },
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
};
