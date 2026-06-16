/**
 * Targeted code-graph queries (4.0 consolidation).
 *
 * Extracted from the (removed) `projscan_graph` tool so the capability lives in
 * one tested place and folds into `projscan_semantic_graph` — which previously
 * only dumped the whole graph. This is what makes semantic_graph a true
 * superset of the old graph tool: it answers the same targeted "who imports X",
 * "what does X export", "where is symbol S defined" questions without serializing
 * the entire graph.
 */

import {
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
  type CodeGraph,
} from './codeGraph.js';

export type GraphQueryDirection =
  | 'imports'
  | 'exports'
  | 'importers'
  | 'symbol_defs'
  | 'package_importers';

export interface GraphQueryInput {
  direction: GraphQueryDirection;
  /** Repo-relative file path (for imports/exports/importers). */
  file?: string;
  /** Symbol or package name (for symbol_defs/package_importers). */
  symbol?: string;
  /** Max entries returned (1–500, default 50). */
  limit?: number;
}

const DEFAULT_LIMIT = 50;

/** Run one targeted query against a built code graph. Throws on missing args. */
export function runGraphQuery(graph: CodeGraph, input: GraphQueryInput): Record<string, unknown> {
  const { direction, file, symbol } = input;
  const limit = Math.max(
    1,
    Math.min(500, typeof input.limit === 'number' ? input.limit : DEFAULT_LIMIT),
  );

  switch (direction) {
    case 'imports': {
      if (!file)
        throw new Error(
          'direction=imports requires a `file` argument (repo-relative path, e.g. "src/auth.ts").',
        );
      return { file, imports: importsOf(graph, file).slice(0, limit) };
    }
    case 'exports': {
      if (!file)
        throw new Error('direction=exports requires a `file` argument (repo-relative path).');
      return { file, exports: exportsOf(graph, file).slice(0, limit) };
    }
    case 'importers': {
      if (!file)
        throw new Error('direction=importers requires a `file` argument (repo-relative path).');
      return { file, importers: filesImportingFile(graph, file).slice(0, limit) };
    }
    case 'symbol_defs': {
      if (!symbol)
        throw new Error(
          'direction=symbol_defs requires a `symbol` argument (the exported name, e.g. "authenticate").',
        );
      return { symbol, definedIn: filesDefiningSymbol(graph, symbol).slice(0, limit) };
    }
    case 'package_importers': {
      const pkg = symbol ?? file;
      if (!pkg)
        throw new Error(
          'direction=package_importers requires a `symbol` (or `file`) arg (the npm package name, e.g. "chalk").',
        );
      return { package: pkg, importers: filesImportingPackage(graph, pkg).slice(0, limit) };
    }
    default:
      throw new Error(
        `unknown direction "${String(direction)}". Valid: imports, exports, importers, symbol_defs, package_importers.`,
      );
  }
}
