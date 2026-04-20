import type { FileEntry } from '../types.js';
import { buildCodeGraph, toPackageName as graphToPackageName } from './codeGraph.js';

export interface ImportGraph {
  /** file → set of import specifiers exactly as they appear in source */
  byFile: Map<string, Set<string>>;
  /** unique set of non-relative, non-builtin specifiers (package names) */
  externalPackages: Set<string>;
  /** count of source files scanned */
  scannedFiles: number;
}

/**
 * Walk source files and build an import graph. Now backed by AST-based
 * codeGraph - this function is retained for public API compatibility.
 */
export async function buildImportGraph(
  rootPath: string,
  files: FileEntry[],
): Promise<ImportGraph> {
  const code = await buildCodeGraph(rootPath, files);

  const byFile = new Map<string, Set<string>>();
  const externalPackages = new Set<string>();

  for (const [file, entry] of code.files) {
    const specifiers = new Set<string>();
    for (const imp of entry.imports) {
      specifiers.add(imp.source);
      const pkg = graphToPackageName(imp.source);
      if (pkg) externalPackages.add(pkg);
    }
    byFile.set(file, specifiers);
  }

  return { byFile, externalPackages, scannedFiles: code.scannedFiles };
}

/** Convert an import specifier to a bare package name. */
export const toPackageName = graphToPackageName;

/** Check if a package is referenced by at least one file in the graph. */
export function isPackageUsed(graph: ImportGraph, pkg: string): boolean {
  return graph.externalPackages.has(pkg);
}

/** List files that import a given package. */
export function filesImporting(graph: ImportGraph, pkg: string): string[] {
  const out: string[] = [];
  for (const [file, specifiers] of graph.byFile) {
    for (const spec of specifiers) {
      if (toPackageName(spec) === pkg) {
        out.push(file);
        break;
      }
    }
  }
  return out.sort();
}
