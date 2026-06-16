import type { AstExport, AstImport } from './ast.js';
import { getAdapterFor } from './languages/registry.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './languages/LanguageAdapter.js';

interface StarReexportGraphFile extends GraphFileLike {
  imports: AstImport[];
  exports: AstExport[];
}

export function expandLocalStarReexports(
  graphFiles: Map<string, StarReexportGraphFile>,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): void {
  for (let pass = 0; pass < graphFiles.size; pass++) {
    if (!expandLocalStarReexportsOnce(graphFiles, contextByAdapter)) return;
  }
}

function expandLocalStarReexportsOnce(
  graphFiles: Map<string, StarReexportGraphFile>,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): boolean {
  let changed = false;
  for (const [file, entry] of graphFiles) {
    if (expandFileLocalStarReexports(file, entry, graphFiles, contextByAdapter)) {
      changed = true;
    }
  }
  return changed;
}

function expandFileLocalStarReexports(
  file: string,
  entry: StarReexportGraphFile,
  graphFiles: Map<string, StarReexportGraphFile>,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): boolean {
  const adapter = getAdapterFor(file);
  if (!adapter) return false;

  const context = contextByAdapter.get(adapter) ?? {};
  const seenExports = new Set(entry.exports.map((exp) => exp.name));
  let changed = false;
  for (const imp of entry.imports) {
    const targetEntry = resolveLocalStarReexportTarget(file, imp, adapter, context, graphFiles);
    if (!targetEntry) continue;
    if (copyStarReexportedSymbols(entry, targetEntry, imp, seenExports)) changed = true;
  }
  return changed;
}

function resolveLocalStarReexportTarget(
  file: string,
  imp: AstImport,
  adapter: LanguageAdapter,
  context: LanguageResolveContext,
  graphFiles: Map<string, StarReexportGraphFile>,
): StarReexportGraphFile | null {
  if (!isLocalStarReexport(imp)) return null;
  const target = adapter.resolveImport(
    file,
    imp.source,
    graphFiles as Map<string, GraphFileLike>,
    context,
  );
  if (!target || target === file) return null;
  return graphFiles.get(target) ?? null;
}

function copyStarReexportedSymbols(
  entry: StarReexportGraphFile,
  targetEntry: StarReexportGraphFile,
  imp: AstImport,
  seenExports: Set<string>,
): boolean {
  let changed = false;
  for (const exp of targetEntry.exports) {
    if (exp.name === 'default' || seenExports.has(exp.name)) continue;
    entry.exports.push({
      ...exp,
      typeOnly: imp.typeOnly || exp.typeOnly,
      line: imp.line || exp.line,
    });
    seenExports.add(exp.name);
    changed = true;
  }
  return changed;
}

export function isLocalStarReexport(imp: AstImport): boolean {
  return imp.kind === 'reexport' && imp.specifiers.length === 0;
}
