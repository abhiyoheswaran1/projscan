import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractCppImports } from './cppImports.js';
import { extractCppExports } from './cppExports.js';
import { extractCppCyclomatic } from './cppCyclomatic.js';
import { extractCppFunctions } from './cppFunctions.js';
import { extractCppCallSites } from './cppCallSites.js';
import { detectCppProject, type CppProjectInfo } from './cppManifests.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';

const CPP_EXTENSIONS = new Set(['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hxx']);
const SOURCE_EXTENSIONS = new Set(['.cpp', '.cc', '.cxx', '.c']);
const MAX_CPP_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-cpp.wasm');
  return parserPromise;
}

export const cppAdapter: LanguageAdapter = {
  id: 'cpp',
  extensions: CPP_EXTENSIONS,
  // Only .cpp/.cc/.cxx/.c are "source" for dead-code purposes; headers
  // hold the declarations they consume.
  sourceExtensions: SOURCE_EXTENSIONS,
  barrelBasenames: new Set(),
  maxFileSize: MAX_CPP_FILE,

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
      const root = tree.rootNode as unknown as Parameters<typeof extractCppImports>[0];
      const imports = extractCppImports(root);
      const exports = extractCppExports(root as Parameters<typeof extractCppExports>[0]);
      const cyclomaticComplexity = extractCppCyclomatic(
        root as Parameters<typeof extractCppCyclomatic>[0],
      );
      const callSites = extractCppCallSites(root as Parameters<typeof extractCppCallSites>[0]);
      const functions = extractCppFunctions(root as Parameters<typeof extractCppFunctions>[0]);
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
        reason: `cpp parse failure: ${msg.slice(0, 120)}`,
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
    return resolveCppImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    // For #include, the "package" is the system header name (`vector`,
    // `iostream`) when angle-bracketed. Quoted includes are project-local
    // and should resolve via resolveImport — but we don't know quoting
    // at this layer, so we conservatively return null for paths that
    // look relative (`./`, `../`, contain `/`) and the bare leaf for
    // angle-bracket-style names.
    if (source.startsWith('./') || source.startsWith('../')) return null;
    if (source.includes('/')) return source.split('/')[0];
    return source;
  },

  async preparePackageRoots(rootPath: string, files: FileEntry[]): Promise<LanguageResolveContext> {
    const info = await detectCppProject(rootPath, files);
    return {
      packageRoots: info
        ? info.includeRoots.map((r) => path.relative(rootPath, path.join(rootPath, r)) || '.')
        : [],
      meta: info ? { cppProject: info } : undefined,
    };
  },
};

/**
 * Resolve a C++ `#include` source to a repo-local file. We try, in order:
 *
 *   1. Relative to the importing file's directory (quoted-include semantics).
 *   2. Each detected include root (e.g., `include/`, `src/`, `lib/`).
 *
 * We return the first hit. Standard-library / third-party headers (e.g.,
 * `<vector>`, `<boost/optional.hpp>`) won't match anything in the graph
 * and resolve to null, which is correct — they're external.
 */
function resolveCppImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const project = (context.meta as { cppProject?: CppProjectInfo } | undefined)?.cppProject;
  const includeRoots = context.packageRoots ?? project?.includeRoots ?? [];

  // 1) Relative to the importing file. tree-sitter doesn't tell us whether
  // the source was quoted or angle-bracketed, but the resolver works the
  // same way for either: we try the importing file's directory first.
  const importingDir = path.posix.dirname(importingFile);
  const relative = normalizeRelative(importingDir, source);
  if (relative && graphFiles.has(relative)) return relative;

  // 2) Each include root.
  for (const root of includeRoots) {
    const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);
    const candidate = [...rootSegs, ...source.split('/').filter(Boolean)].join('/');
    if (graphFiles.has(candidate)) return candidate;
  }
  return null;
}

function normalizeRelative(baseDir: string, source: string): string | null {
  // Strip any leading `./`. For `../foo`, walk up the baseDir.
  let dir = baseDir === '.' ? '' : baseDir;
  let rest = source;
  while (rest.startsWith('./')) rest = rest.slice(2);
  while (rest.startsWith('../')) {
    if (!dir) return null;
    dir = path.posix.dirname(dir);
    if (dir === '.') dir = '';
    rest = rest.slice(3);
  }
  return dir ? `${dir}/${rest}` : rest;
}
