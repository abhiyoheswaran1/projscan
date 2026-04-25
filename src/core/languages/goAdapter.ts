import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractGoImports } from './goImports.js';
import { extractGoExports } from './goExports.js';
import { extractGoCyclomatic } from './goCyclomatic.js';
import { extractGoCallSites } from './goCallSites.js';
import { detectGoProject, type GoProjectInfo } from './goManifests.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

const GO_EXTENSIONS = new Set(['.go']);
const MAX_GO_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-go.wasm');
  return parserPromise;
}

export const goAdapter: LanguageAdapter = {
  id: 'go',
  extensions: GO_EXTENSIONS,
  sourceExtensions: GO_EXTENSIONS,
  // Go has no analogue to JS `index.ts` or Python `__init__.py` - every .go
  // file in a directory contributes to the same package. Leave empty.
  barrelBasenames: new Set(),
  maxFileSize: MAX_GO_FILE,

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
      const root = tree.rootNode as unknown as Parameters<typeof extractGoImports>[0];
      const imports = extractGoImports(root);
      const exports = extractGoExports(root as Parameters<typeof extractGoExports>[0]);
      const cyclomaticComplexity = extractGoCyclomatic(root as Parameters<typeof extractGoCyclomatic>[0]);
      const callSites = extractGoCallSites(root as Parameters<typeof extractGoCallSites>[0]);
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
        reason: `go parse failure: ${msg.slice(0, 120)}`,
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
    return resolveGoImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    // Standard library imports like "fmt", "net/http" - package = first segment.
    // Third-party like "github.com/foo/bar" - package = whole path.
    if (source.startsWith('.')) return null; // local
    if (source.includes('/')) return source; // module path; treat as a single "package"
    return source;
  },

  async preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> {
    const info = await detectGoProject(rootPath, files);
    return {
      packageRoots: info ? [path.relative(rootPath, info.moduleRoot) || '.'] : [],
      meta: info ? { goProject: info } : undefined,
    };
  },
};

function resolveGoImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const goProject = (context.meta as { goProject?: GoProjectInfo } | undefined)?.goProject;
  if (!goProject) return null;

  // Local imports (rare and discouraged in modern Go): ./foo or ../bar.
  if (source.startsWith('.')) {
    const dir = path.posix.dirname(importingFile);
    const joined = path.posix.normalize(path.posix.join(dir, source));
    return findPackageDir(joined, graphFiles);
  }

  // Module-prefixed imports resolve into the repo. Strip the module path,
  // anything left is a directory within the module.
  if (source === goProject.modulePath) {
    return findPackageDir('', graphFiles);
  }
  const prefix = goProject.modulePath + '/';
  if (source.startsWith(prefix)) {
    const sub = source.slice(prefix.length);
    return findPackageDir(sub, graphFiles);
  }

  // Anything else (stdlib, third-party) is external.
  return null;
}

/**
 * Resolve an import to ANY .go file inside the target directory. Go packages
 * are directory-scoped - a single file is enough to anchor the edge in the
 * graph. We pick the lexicographically first match for determinism.
 */
function findPackageDir(
  relDir: string,
  graphFiles: Map<string, GraphFileLike>,
): string | null {
  const dir = relDir === '' || relDir === '.' ? '' : relDir;
  const prefix = dir ? dir + '/' : '';
  const matches: string[] = [];
  for (const file of graphFiles.keys()) {
    if (!file.endsWith('.go')) continue;
    if (file.startsWith(prefix)) {
      // Must be a direct child, not nested deeper. Go packages don't transitively
      // include subdirectories.
      const tail = file.slice(prefix.length);
      if (!tail.includes('/')) matches.push(file);
    }
  }
  if (matches.length === 0) return null;
  matches.sort();
  return matches[0];
}
