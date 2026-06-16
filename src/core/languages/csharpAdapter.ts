import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractCsharpImports } from './csharpImports.js';
import { extractCsharpExports } from './csharpExports.js';
import { extractCsharpCyclomatic } from './csharpCyclomatic.js';
import { extractCsharpFunctions } from './csharpFunctions.js';
import { extractCsharpCallSites } from './csharpCallSites.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';

const CSHARP_EXTENSIONS = new Set(['.cs']);
const MAX_CSHARP_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-c_sharp.wasm');
  return parserPromise;
}

export const csharpAdapter: LanguageAdapter = {
  id: 'csharp',
  extensions: CSHARP_EXTENSIONS,
  sourceExtensions: CSHARP_EXTENSIONS,
  // C# has no barrel-file convention.
  barrelBasenames: new Set(),
  maxFileSize: MAX_CSHARP_FILE,

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
      const root = tree.rootNode as unknown as Parameters<typeof extractCsharpImports>[0];
      const imports = extractCsharpImports(root);
      const exports = extractCsharpExports(root as Parameters<typeof extractCsharpExports>[0]);
      const cyclomaticComplexity = extractCsharpCyclomatic(
        root as Parameters<typeof extractCsharpCyclomatic>[0],
      );
      const callSites = extractCsharpCallSites(
        root as Parameters<typeof extractCsharpCallSites>[0],
      );
      const functions = extractCsharpFunctions(
        root as Parameters<typeof extractCsharpFunctions>[0],
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
        reason: `c# parse failure: ${msg.slice(0, 120)}`,
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
    return resolveCsharpImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    // The first dotted segment. `System.X` lands on the BCL, anything else
    // could be a NuGet package (e.g. `Newtonsoft.Json`) or a local namespace.
    return source.split('.')[0];
  },

  async preparePackageRoots(rootPath: string, files: FileEntry[]): Promise<LanguageResolveContext> {
    // Find every .csproj file; each defines a project root and a default
    // root namespace (the csproj filename without `.csproj`). When an import
    // starts with that root namespace we strip it before mapping to a path.
    const projects: Array<{ dir: string; rootNamespace: string }> = [];
    for (const f of files) {
      if (!f.relativePath.endsWith('.csproj')) continue;
      const dir = path.posix.dirname(f.relativePath);
      const stem = path.posix.basename(f.relativePath, '.csproj');
      projects.push({ dir: dir === '' ? '.' : dir, rootNamespace: stem });
    }
    const packageRoots = projects.length > 0 ? projects.map((p) => p.dir) : ['.'];
    return { packageRoots, meta: { repoRoot: rootPath, csharpProjects: projects } };
  },
};

interface CsharpProjectInfo {
  dir: string;
  rootNamespace: string;
}

/**
 * Resolve a C# `using` to a repo-local file or null.
 *
 * Strategy: C# has no manifest equivalent of PSR-4 — namespaces map to
 * filesystem paths by *convention*. For `using A.B.C;` we probe each
 * project root with `<root>/A/B/C.cs`, `<root>/A/B/C/<importingBasename>.cs`,
 * and a few other shapes. The grammar itself can't tell us whether `C` is
 * a type or a namespace, so we try the type-shape first.
 */
function resolveCsharpImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const baseSegments = source.split('.').filter(Boolean);
  if (baseSegments.length === 0) return null;

  const projects =
    (context.meta as { csharpProjects?: CsharpProjectInfo[] } | undefined)?.csharpProjects ?? [];
  const projectList: Array<{ dir: string; strip: string[] }> =
    projects.length > 0
      ? projects.map((p) => ({ dir: p.dir, strip: p.rootNamespace.split('.').filter(Boolean) }))
      : [{ dir: '.', strip: [] }];

  for (const { dir, strip } of projectList) {
    const rootSegs = dir === '.' || dir === '' ? [] : dir.split('/').filter(Boolean);

    const candidates: string[][] = [];
    candidates.push(baseSegments);
    if (strip.length > 0 && segmentsStartWith(baseSegments, strip)) {
      candidates.push(baseSegments.slice(strip.length));
    }

    for (const segs of candidates) {
      if (segs.length === 0) continue;
      const last = segs[segs.length - 1];

      // <root>/A/B/C.cs (type-name file under the namespace dir).
      const typeFile = [...rootSegs, ...segs].join('/') + '.cs';
      if (graphFiles.has(typeFile)) return typeFile;

      // <root>/A/B/<last>.cs — same as above but expressing it via the
      // explicit type-name path.
      const dirPath = [...rootSegs, ...segs].join('/');
      const candidate = `${dirPath}/${last}.cs`;
      if (graphFiles.has(candidate)) return candidate;
    }
  }
  return null;
}

function segmentsStartWith(segs: string[], prefix: string[]): boolean {
  if (prefix.length > segs.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (segs[i] !== prefix[i]) return false;
  }
  return true;
}
