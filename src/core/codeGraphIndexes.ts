import type { AstExport, AstImport } from './ast.js';
import { getAdapterFor } from './languages/registry.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './languages/LanguageAdapter.js';

interface IndexGraphFile extends GraphFileLike {
  imports: AstImport[];
  exports: AstExport[];
}

export interface CodeGraphIndexes {
  localImporters: Map<string, Set<string>>;
  packageImporters: Map<string, Set<string>>;
  symbolDefs: Map<string, Set<string>>;
}

/**
 * Rebuild the three cross-file derived indexes from scratch:
 *   - localImporters: target file -> set of files importing it
 *   - packageImporters: package name -> set of files importing it
 *   - symbolDefs: exported name -> set of files defining it
 *
 * Each adapter gets a shot at local resolution first (matters for
 * Python's `pkg.core` which may be local OR third-party); falls back
 * to package-name classification.
 */
export function rebuildCrossFileIndexes(
  graphFiles: Map<string, IndexGraphFile>,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): CodeGraphIndexes {
  const indexes: CodeGraphIndexes = {
    localImporters: new Map(),
    packageImporters: new Map(),
    symbolDefs: new Map(),
  };

  for (const [importingFile, entry] of graphFiles) {
    indexGraphFile(importingFile, entry, graphFiles, contextByAdapter, indexes);
  }

  return indexes;
}

function indexGraphFile(
  importingFile: string,
  entry: IndexGraphFile,
  graphFiles: Map<string, IndexGraphFile>,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
  indexes: CodeGraphIndexes,
): void {
  const adapter = getAdapterFor(importingFile);
  if (!adapter) return;

  const context = contextByAdapter.get(adapter) ?? {};
  indexImports(importingFile, entry.imports, adapter, context, graphFiles, indexes);
  indexExports(importingFile, entry.exports, indexes);
}

function indexImports(
  importingFile: string,
  imports: AstImport[],
  adapter: LanguageAdapter,
  context: LanguageResolveContext,
  graphFiles: Map<string, IndexGraphFile>,
  indexes: CodeGraphIndexes,
): void {
  for (const imp of imports) {
    const resolved = adapter.resolveImport(importingFile, imp.source, graphFiles, context);
    if (resolved) {
      addIndexValue(indexes.localImporters, resolved, importingFile);
      continue;
    }

    const pkg = adapter.toPackageName(imp.source);
    if (pkg) addIndexValue(indexes.packageImporters, pkg, importingFile);
  }
}

function indexExports(
  importingFile: string,
  exports: AstExport[],
  indexes: CodeGraphIndexes,
): void {
  for (const exp of exports) {
    if (exp.name) addIndexValue(indexes.symbolDefs, exp.name, importingFile);
  }
}

function addIndexValue(index: Map<string, Set<string>>, key: string, value: string): void {
  let values = index.get(key);
  if (!values) {
    values = new Set();
    index.set(key, values);
  }
  values.add(value);
}
