import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';

export type LanguageId = 'javascript' | 'python';

export interface LanguageResolveContext {
  /** Language-specific root dirs used during import resolution. */
  packageRoots?: string[];
  meta?: Record<string, unknown>;
}

export interface GraphFileLike {
  relativePath: string;
}

export interface LanguageAdapter {
  id: LanguageId;
  /** File extensions this adapter claims (lowercase, with dot). */
  extensions: ReadonlySet<string>;
  /** Max file size to parse. Defaults to 1 MB at the call site. */
  maxFileSize?: number;
  /** Barrel filenames (sans extension) to skip in dead-code analysis. */
  barrelBasenames?: ReadonlySet<string>;
  /** Source extensions used for dead-code analysis (a subset or equal of `extensions`). */
  sourceExtensions?: ReadonlySet<string>;

  /** Parse a file. Must never throw; returns ok:false on failure. */
  parse(filePath: string, content: string): AstResult | Promise<AstResult>;

  /**
   * Resolve a single import source against the graph's known files.
   * Called during graph-building AFTER all files are parsed.
   */
  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null;

  /**
   * Return the bare external package name for this specifier, or null for
   * "local/relative, let resolveImport handle it."
   */
  toPackageName(source: string): string | null;

  /** One-time per-scan setup. Called before any parse. */
  preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> | LanguageResolveContext;
}
