import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractKotlinImports } from './kotlinImports.js';
import { extractKotlinExports } from './kotlinExports.js';
import { extractKotlinCyclomatic } from './kotlinCyclomatic.js';
import { extractKotlinFunctions } from './kotlinFunctions.js';
import { extractKotlinCallSites } from './kotlinCallSites.js';
import { detectKotlinProject, type KotlinProjectInfo } from './kotlinManifests.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';

const KOTLIN_EXTENSIONS = new Set(['.kt', '.kts']);
const MAX_KOTLIN_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-kotlin.wasm');
  return parserPromise;
}

export const kotlinAdapter: LanguageAdapter = {
  id: 'kotlin',
  extensions: KOTLIN_EXTENSIONS,
  sourceExtensions: KOTLIN_EXTENSIONS,
  // Kotlin has no "barrel-file" idiom; entry-points are .kt files with `fun main`.
  barrelBasenames: new Set(),
  maxFileSize: MAX_KOTLIN_FILE,

  async parse(_filePath: string, content: string): Promise<AstResult> {
    try {
      const parser = await getParser();
      const tree = parser.parse(content);
      if (!tree || !tree.rootNode) {
        return {
          ok: false,
          reason: 'tree-sitter returned null tree',
          imports: [],
          exports: [],
          callSites: [],
          lineCount: content ? content.split('\n').length : 0,
          cyclomaticComplexity: 0,
          functions: [],
        };
      }
      const root = tree.rootNode as unknown as Parameters<typeof extractKotlinImports>[0];
      const imports = extractKotlinImports(root);
      const exports = extractKotlinExports(root as Parameters<typeof extractKotlinExports>[0]);
      const cyclomaticComplexity = extractKotlinCyclomatic(
        root as Parameters<typeof extractKotlinCyclomatic>[0],
      );
      const callSites = extractKotlinCallSites(
        root as Parameters<typeof extractKotlinCallSites>[0],
      );
      const functions = extractKotlinFunctions(
        root as Parameters<typeof extractKotlinFunctions>[0],
      );
      return {
        ok: true,
        imports,
        exports,
        callSites,
        lineCount: content ? content.split('\n').length : 0,
        cyclomaticComplexity,
        functions,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: `kotlin parse failure: ${msg.slice(0, 120)}`,
        imports: [],
        exports: [],
        callSites: [],
        lineCount: content ? content.split('\n').length : 0,
        cyclomaticComplexity: 0,
        functions: [],
      };
    }
  },

  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null {
    return resolveKotlinImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    // Heuristic: a Kotlin import that begins with the project's own
    // detected source-root directory shouldn't be a "package" — but at
    // graph-build time we don't have project info here. Defer to
    // resolveImport: anything that resolveImport can't pin to a local
    // file falls through as external.
    return source.split('.')[0] || null;
  },

  async preparePackageRoots(rootPath: string, files: FileEntry[]): Promise<LanguageResolveContext> {
    const info = await detectKotlinProject(rootPath, files);
    return {
      packageRoots: info
        ? info.packageRoots.map((r) => path.relative(rootPath, path.join(rootPath, r)) || '.')
        : [],
      meta: info ? { kotlinProject: info } : undefined,
    };
  },
};

/**
 * Resolve a Kotlin `import com.foo.Bar` to a repo-local file. The path
 * `com.foo.Bar` becomes `com/foo/Bar.kt` under each known package root.
 * Wildcard imports (`com.foo.*`) resolve to `com/foo/<any>.kt` and we
 * pick the first match if any. Non-local (stdlib, third-party) imports
 * return null.
 */
function resolveKotlinImport(
  _importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const project = (context.meta as { kotlinProject?: KotlinProjectInfo } | undefined)
    ?.kotlinProject;
  const packageRoots = context.packageRoots ?? project?.packageRoots ?? [];
  if (packageRoots.length === 0) return null;

  const isWildcard = source.endsWith('.*');
  const cleanedSegments = (isWildcard ? source.slice(0, -2) : source).split('.').filter(Boolean);
  if (cleanedSegments.length === 0) return null;

  for (const root of packageRoots) {
    const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);

    if (isWildcard) {
      const dirParts = [...rootSegs, ...cleanedSegments];
      const prefix = dirParts.join('/') + '/';
      // Pick any file under that package directory.
      for (const key of graphFiles.keys()) {
        if (key.startsWith(prefix) && (key.endsWith('.kt') || key.endsWith('.kts'))) {
          return key;
        }
      }
      continue;
    }

    // Non-wildcard: try each segment count from full → 1, since the last segment
    // could be a class name OR a file name. Try `com/foo/Bar.kt`, then if not
    // found try `com/foo.kt` (top-level decl in Foo.kt).
    for (let drop = 0; drop <= 1; drop++) {
      const segs = cleanedSegments.slice(0, cleanedSegments.length - drop);
      if (segs.length === 0) break;
      const baseSegs = [...rootSegs, ...segs.slice(0, -1)];
      const fileName = segs[segs.length - 1];
      const asKt = [...baseSegs, `${fileName}.kt`].join('/');
      if (graphFiles.has(asKt)) return asKt;
      const asKts = [...baseSegs, `${fileName}.kts`].join('/');
      if (graphFiles.has(asKts)) return asKts;
    }
  }
  return null;
}
