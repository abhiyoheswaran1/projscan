import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractRustImports } from './rustImports.js';
import { extractRustExports } from './rustExports.js';
import { extractRustCyclomatic } from './rustCyclomatic.js';
import { extractRustFunctions } from './rustFunctions.js';
import { extractRustCallSites } from './rustCallSites.js';
import { detectRustProject, type RustProjectInfo } from './rustManifests.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';

const RUST_EXTENSIONS = new Set(['.rs']);
const MAX_RUST_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-rust.wasm');
  return parserPromise;
}

export const rustAdapter: LanguageAdapter = {
  id: 'rust',
  extensions: RUST_EXTENSIONS,
  sourceExtensions: RUST_EXTENSIONS,
  // Rust has no barrel-file convention. mod.rs is closest but it's a module
  // root, not a re-export hub in the JS sense.
  barrelBasenames: new Set(),
  maxFileSize: MAX_RUST_FILE,

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
      const root = tree.rootNode as unknown as Parameters<typeof extractRustImports>[0];
      const imports = extractRustImports(root);
      const exports = extractRustExports(root as Parameters<typeof extractRustExports>[0]);
      const cyclomaticComplexity = extractRustCyclomatic(
        root as Parameters<typeof extractRustCyclomatic>[0],
      );
      const callSites = extractRustCallSites(root as Parameters<typeof extractRustCallSites>[0]);
      const functions = extractRustFunctions(root as Parameters<typeof extractRustFunctions>[0]);
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
        reason: `rust parse failure: ${msg.slice(0, 120)}`,
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
    return resolveRustImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    if (source.startsWith('crate::') || source === 'crate') return null;
    if (source.startsWith('self::') || source === 'self') return null;
    if (source.startsWith('super::') || source === 'super') return null;
    return source.split('::')[0];
  },

  async preparePackageRoots(rootPath: string, files: FileEntry[]): Promise<LanguageResolveContext> {
    const info = await detectRustProject(rootPath, files);
    return {
      packageRoots: info ? [path.relative(rootPath, info.crateRoot) || '.'] : [],
      meta: info ? { rustProject: info } : undefined,
    };
  },
};

/**
 * Resolve a Rust `use` path to a repo-local file, or null if the import
 * targets the standard library / a third-party crate.
 *
 *   crate::foo::bar  → resolve against the crate's `src/` root.
 *   self::foo        → resolve against the importing file's directory.
 *   super::foo       → resolve against the importing file's parent.
 *   <crateName>::…   → same as crate:: for the project's own crate.
 *   anything else    → null (external).
 *
 * Probes are file-flavoured: `foo` resolves to `foo.rs` or `foo/mod.rs`.
 */
function resolveRustImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  if (!source) return null;
  const segments = source.split('::').filter(Boolean);
  if (segments.length === 0) return null;

  const project = (context.meta as { rustProject?: RustProjectInfo } | undefined)?.rustProject;

  // self:: / super::… - relative to the importing file.
  if (segments[0] === 'self' || segments[0] === 'super') {
    const importingDir = path.posix.dirname(importingFile);
    let dir = importingDir;
    let i = 0;
    while (i < segments.length && segments[i] === 'super') {
      dir = path.posix.dirname(dir);
      if (dir === '.' || dir === '/' || dir === '') {
        dir = '';
        break;
      }
      i++;
    }
    if (segments[i] === 'self') i++;
    const tail = segments.slice(i, segments.length - 1); // drop final symbol
    const moduleName = tail[tail.length - 1] ?? '';
    if (!moduleName) return null;
    const base = [dir, ...tail.slice(0, -1)].filter(Boolean).join('/');
    return probeRustModule(base, moduleName, graphFiles);
  }

  // crate:: or <crateName>::…
  const isCrate = segments[0] === 'crate' || (project && segments[0] === project.crateName);
  if (isCrate && project) {
    const tail = segments.slice(1, segments.length - 1); // drop final symbol
    const moduleName = tail[tail.length - 1] ?? '';
    if (!moduleName) return null;
    const packageRoots = context.packageRoots ?? ['.'];
    for (const root of packageRoots) {
      const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);
      const base = [...rootSegs, 'src', ...tail.slice(0, -1)].filter(Boolean).join('/');
      const hit = probeRustModule(base, moduleName, graphFiles);
      if (hit) return hit;
    }
    return null;
  }

  return null;
}

function probeRustModule(
  baseDir: string,
  moduleName: string,
  graphFiles: Map<string, GraphFileLike>,
): string | null {
  if (!moduleName) return null;
  const stem = baseDir ? `${baseDir}/${moduleName}` : moduleName;
  const asFile = `${stem}.rs`;
  if (graphFiles.has(asFile)) return asFile;
  const asMod = `${stem}/mod.rs`;
  if (graphFiles.has(asMod)) return asMod;
  return null;
}
