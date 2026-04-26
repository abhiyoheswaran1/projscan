import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractRubyImports } from './rubyImports.js';
import { extractRubyExports } from './rubyExports.js';
import { extractRubyCyclomatic } from './rubyCyclomatic.js';
import { extractRubyFunctions } from './rubyFunctions.js';
import { extractRubyCallSites } from './rubyCallSites.js';
import { detectRubyProject } from './rubyManifests.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

const RUBY_EXTENSIONS = new Set(['.rb']);
const MAX_RUBY_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-ruby.wasm');
  return parserPromise;
}

export const rubyAdapter: LanguageAdapter = {
  id: 'ruby',
  extensions: RUBY_EXTENSIONS,
  sourceExtensions: RUBY_EXTENSIONS,
  // Ruby has no barrel-file convention.
  barrelBasenames: new Set(),
  maxFileSize: MAX_RUBY_FILE,

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
      const root = tree.rootNode as unknown as Parameters<typeof extractRubyImports>[0];
      const imports = extractRubyImports(root);
      const exports = extractRubyExports(root as Parameters<typeof extractRubyExports>[0]);
      const cyclomaticComplexity = extractRubyCyclomatic(
        root as Parameters<typeof extractRubyCyclomatic>[0],
      );
      const callSites = extractRubyCallSites(
        root as Parameters<typeof extractRubyCallSites>[0],
      );
      const functions = extractRubyFunctions(
        root as Parameters<typeof extractRubyFunctions>[0],
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
        reason: `ruby parse failure: ${msg.slice(0, 120)}`,
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
    return resolveRubyImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    // `./foo` and `../foo` are clearly local; let resolveImport handle.
    if (source.startsWith('./') || source.startsWith('../')) return null;
    // Otherwise treat the whole specifier as the gem name (e.g. `json`, `active_support/core_ext`).
    // Take only the first path segment for ranking purposes.
    return source.split('/')[0];
  },

  async preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> {
    const info = await detectRubyProject(rootPath, files);
    if (!info) return { packageRoots: [], meta: undefined };
    return {
      packageRoots: info.sourceRoots.map((r) => path.relative(rootPath, r) || '.'),
      meta: { rubyProject: info },
    };
  },
};

/**
 * Resolve a Ruby require / require_relative to a repo-local file path.
 *
 *   require_relative 'sibling'      → resolved against the importing file's dir.
 *   require_relative '../helpers'   → walked up.
 *   require 'json'                  → null (stdlib / gem; no source-root match).
 *   require 'foo/bar'               → for each sourceRoot, probe `foo/bar.rb`.
 *
 * Ruby `require` semantics depend on $LOAD_PATH at runtime; we approximate by
 * checking sourceRoots (typically `lib/`). This catches the common case where
 * a gem requires its own internal modules by their lib-relative path.
 */
function resolveRubyImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  // The original call site distinguishes require vs require_relative, but by
  // the time we're here we only have the source string. Heuristic: if the
  // string starts with `./` or `../`, treat as relative; otherwise probe BOTH
  // relative-to-importer AND relative-to-each-source-root, and pick the first
  // that resolves. This captures both `require_relative` AND `require` of a
  // gem-internal lib path.
  const sourceWithExt = source.endsWith('.rb') ? source : `${source}.rb`;

  if (source.startsWith('./') || source.startsWith('../')) {
    const dir = path.posix.dirname(importingFile);
    const joined = path.posix.normalize(path.posix.join(dir, sourceWithExt));
    return graphFiles.has(joined) ? joined : null;
  }

  // Try each source root.
  const sourceRootsRel = context.packageRoots ?? ['.'];
  for (const root of sourceRootsRel) {
    const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);
    const candidate = [...rootSegs, sourceWithExt].join('/');
    if (graphFiles.has(candidate)) return candidate;
  }

  // Also try treating the source as relative to the importing file's directory
  // (require_relative without leading `./`). Some style guides drop the prefix.
  const dir = path.posix.dirname(importingFile);
  const joined = path.posix.normalize(path.posix.join(dir, sourceWithExt));
  if (graphFiles.has(joined)) return joined;

  return null;
}
