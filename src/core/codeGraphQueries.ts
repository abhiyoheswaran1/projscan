import type { AstImport, AstExport } from './ast.js';
import type { CodeGraph } from './codeGraphTypes.js';

export function packagesUsed(graph: CodeGraph): Set<string> {
  return new Set(graph.packageImporters.keys());
}

export function filesImportingPackage(graph: CodeGraph, pkg: string): string[] {
  const set = graph.packageImporters.get(pkg);
  return set ? [...set].sort() : [];
}

export function filesImportingFile(graph: CodeGraph, relativePath: string): string[] {
  const set = graph.localImporters.get(relativePath);
  return set ? [...set].sort() : [];
}

export function filesDefiningSymbol(graph: CodeGraph, name: string): string[] {
  const set = graph.symbolDefs.get(name);
  return set ? [...set].sort() : [];
}

export function importersOf(graph: CodeGraph, relativePath: string): string[] {
  return filesImportingFile(graph, relativePath);
}

export function exportsOf(graph: CodeGraph, relativePath: string): AstExport[] {
  return graph.files.get(relativePath)?.exports ?? [];
}

export function importsOf(graph: CodeGraph, relativePath: string): AstImport[] {
  return graph.files.get(relativePath)?.imports ?? [];
}
