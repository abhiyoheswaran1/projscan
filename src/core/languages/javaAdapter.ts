import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractJavaImports } from './javaImports.js';
import { extractJavaExports } from './javaExports.js';
import { extractJavaCyclomatic } from './javaCyclomatic.js';
import { extractJavaCallSites } from './javaCallSites.js';
import { detectJavaProject, type JavaProjectInfo } from './javaManifests.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

const JAVA_EXTENSIONS = new Set(['.java']);
const MAX_JAVA_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-java.wasm');
  return parserPromise;
}

export const javaAdapter: LanguageAdapter = {
  id: 'java',
  extensions: JAVA_EXTENSIONS,
  sourceExtensions: JAVA_EXTENSIONS,
  // Java has no barrel-file convention. A `package-info.java` file is metadata,
  // not a re-export hub.
  barrelBasenames: new Set(),
  maxFileSize: MAX_JAVA_FILE,

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
        };
      }
      const root = tree.rootNode as unknown as Parameters<typeof extractJavaImports>[0];
      const imports = extractJavaImports(root);
      const exports = extractJavaExports(root as Parameters<typeof extractJavaExports>[0]);
      const cyclomaticComplexity = extractJavaCyclomatic(
        root as Parameters<typeof extractJavaCyclomatic>[0],
      );
      const callSites = extractJavaCallSites(
        root as Parameters<typeof extractJavaCallSites>[0],
      );
      return {
        ok: true,
        imports,
        exports,
        callSites,
        lineCount: content ? content.split('\n').length : 0,
        cyclomaticComplexity,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: `java parse failure: ${msg.slice(0, 120)}`,
        imports: [],
        exports: [],
        callSites: [],
        lineCount: content ? content.split('\n').length : 0,
        cyclomaticComplexity: 0,
      };
    }
  },

  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null {
    return resolveJavaImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    if (source.startsWith('.')) return null;
    // Strip wildcard / static-tail to get the dotted package path.
    const base = source.endsWith('.*') ? source.slice(0, -2) : source;
    // Java imports typically end in a TypeName; drop the last segment to get
    // the package. For wildcards the whole thing IS the package.
    if (source.endsWith('.*')) return base;
    const lastDot = base.lastIndexOf('.');
    return lastDot > 0 ? base.slice(0, lastDot) : base;
  },

  async preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> {
    const info = await detectJavaProject(rootPath, files);
    if (!info) return { packageRoots: [], meta: undefined };
    return {
      packageRoots: info.sourceRoots.map((r) => path.relative(rootPath, r) || '.'),
      meta: { javaProject: info },
    };
  },
};

/**
 * Resolve a Java import to a repo-local file path, or null if it refers to a
 * stdlib / third-party type or otherwise cannot be resolved.
 *
 *   import com.foo.Bar;          → for each sourceRoot, probe `com/foo/Bar.java`
 *   import com.foo.*;            → resolve to ANY file under `com/foo/` (rare; we
 *                                  just pick the first match for graph-edge purposes)
 *   import static com.foo.Bar.X; → resolves to `com/foo/Bar.java` (X is a member)
 */
function resolveJavaImport(
  _importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const javaProject = (context.meta as { javaProject?: JavaProjectInfo } | undefined)
    ?.javaProject;
  const sourceRootsRel = context.packageRoots ?? [];
  if (sourceRootsRel.length === 0 && !javaProject) return null;

  const isWildcard = source.endsWith('.*');
  const stripped = isWildcard ? source.slice(0, -2) : source;
  const segments = stripped.split('.').filter(Boolean);
  if (segments.length === 0) return null;

  // For type imports, the last segment is the type name (file basename).
  // For wildcard imports, all segments form the package directory.
  for (const root of sourceRootsRel) {
    const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);

    if (isWildcard) {
      const dir = [...rootSegs, ...segments].join('/');
      const prefix = dir + '/';
      // Pick the first .java file directly under that directory.
      const matches: string[] = [];
      for (const file of graphFiles.keys()) {
        if (!file.endsWith('.java')) continue;
        if (file.startsWith(prefix)) {
          const tail = file.slice(prefix.length);
          if (!tail.includes('/')) matches.push(file);
        }
      }
      if (matches.length > 0) {
        matches.sort();
        return matches[0];
      }
      continue;
    }

    // Non-wildcard: last segment is the type, preceding segments are the path.
    const typeName = segments[segments.length - 1];
    const pkgPath = segments.slice(0, -1);
    const candidate = [...rootSegs, ...pkgPath, `${typeName}.java`].join('/');
    if (graphFiles.has(candidate)) return candidate;
  }

  return null;
}
