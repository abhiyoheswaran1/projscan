import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractSwiftImports } from './swiftImports.js';
import { extractSwiftExports } from './swiftExports.js';
import { extractSwiftCyclomatic } from './swiftCyclomatic.js';
import { extractSwiftFunctions } from './swiftFunctions.js';
import { extractSwiftCallSites } from './swiftCallSites.js';
import { detectSwiftProject, type SwiftProjectInfo } from './swiftManifests.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

const SWIFT_EXTENSIONS = new Set(['.swift']);
const MAX_SWIFT_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-swift.wasm');
  return parserPromise;
}

export const swiftAdapter: LanguageAdapter = {
  id: 'swift',
  extensions: SWIFT_EXTENSIONS,
  sourceExtensions: SWIFT_EXTENSIONS,
  barrelBasenames: new Set(),
  maxFileSize: MAX_SWIFT_FILE,

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
      const root = tree.rootNode as unknown as Parameters<typeof extractSwiftImports>[0];
      const imports = extractSwiftImports(root);
      const exports = extractSwiftExports(root as Parameters<typeof extractSwiftExports>[0]);
      const cyclomaticComplexity = extractSwiftCyclomatic(
        root as Parameters<typeof extractSwiftCyclomatic>[0],
      );
      const callSites = extractSwiftCallSites(
        root as Parameters<typeof extractSwiftCallSites>[0],
      );
      const functions = extractSwiftFunctions(
        root as Parameters<typeof extractSwiftFunctions>[0],
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
        reason: `swift parse failure: ${msg.slice(0, 120)}`,
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
    _importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null {
    return resolveSwiftImport(source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    return source.split('.')[0] || null;
  },

  async preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> {
    const info = await detectSwiftProject(rootPath, files);
    return {
      packageRoots: info ? info.packageRoots.map((r) => path.relative(rootPath, path.join(rootPath, r)) || '.') : [],
      meta: info ? { swiftProject: info } : undefined,
    };
  },
};

/**
 * Resolve a Swift `import Foo` to a repo-local file. Swift imports bind a
 * module name, not a file path; for SwiftPM-style projects the convention
 * is one Sources/<ModuleName>/ directory per module. We probe for any
 * .swift file under <root>/<source-root>/<ModuleName>/ that exists in the
 * graph and pick the first match (typically <ModuleName>.swift if present,
 * otherwise the lexicographically first file). For sub-module imports
 * (`import Foo.Bar`) we look for Bar.swift inside Foo's directory.
 */
function resolveSwiftImport(
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const project = (context.meta as { swiftProject?: SwiftProjectInfo } | undefined)?.swiftProject;
  const packageRoots = context.packageRoots ?? project?.packageRoots ?? [];
  if (packageRoots.length === 0) return null;

  const segments = source.split('.').filter(Boolean);
  if (segments.length === 0) return null;

  for (const root of packageRoots) {
    const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const fileName = segments[segments.length - 1];
      const dirSegs = [...rootSegs, ...segments.slice(0, -1)];
      const asFile = [...dirSegs, `${fileName}.swift`].join('/');
      if (graphFiles.has(asFile)) return asFile;
    }
    const moduleDir = [...rootSegs, ...segments].join('/');
    const preferred = [...rootSegs, ...segments, `${segments[segments.length - 1]}.swift`].join('/');
    if (graphFiles.has(preferred)) return preferred;
    const prefix = moduleDir + '/';
    let firstHit: string | null = null;
    for (const key of graphFiles.keys()) {
      if (key.startsWith(prefix) && key.endsWith('.swift')) {
        if (firstHit === null || key < firstHit) firstHit = key;
      }
    }
    if (firstHit) return firstHit;
  }
  return null;
}
