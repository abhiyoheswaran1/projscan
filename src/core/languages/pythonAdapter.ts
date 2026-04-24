import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { AstResult } from '../ast.js';
import { createParserFor } from './treeSitterLoader.js';
import { extractPythonImports } from './pythonImports.js';
import { extractPythonExports } from './pythonExports.js';
import { detectPythonProject } from './pythonManifests.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

// Pinned grammar: tree-sitter-python 0.25.0. See treeSitterLoader.ts.

const PY_EXTENSIONS = new Set(['.py', '.pyw', '.pyi']);
const MAX_PY_FILE = 1024 * 1024;

let parserPromise: Promise<import('web-tree-sitter').Parser> | null = null;
async function getParser(): Promise<import('web-tree-sitter').Parser> {
  if (!parserPromise) parserPromise = createParserFor('tree-sitter-python.wasm');
  return parserPromise;
}

/**
 * Python adapter skeleton. This bring-up stage only proves the parser loads
 * and produces a tree. Imports/exports extraction follows in subsequent tasks.
 */
export const pythonAdapter: LanguageAdapter = {
  id: 'python',
  extensions: PY_EXTENSIONS,
  sourceExtensions: new Set(['.py', '.pyw']),
  barrelBasenames: new Set(['__init__']),
  maxFileSize: MAX_PY_FILE,

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
        };
      }
      const imports = extractPythonImports(tree.rootNode as unknown as Parameters<typeof extractPythonImports>[0]);
      const exports = extractPythonExports(tree.rootNode as unknown as Parameters<typeof extractPythonExports>[0]);
      return {
        ok: true,
        imports,
        exports,
        callSites: [],
        lineCount: content ? content.split('\n').length : 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: `python parse failure: ${msg.slice(0, 120)}`,
        imports: [],
        exports: [],
        callSites: [],
        lineCount: content ? content.split('\n').length : 0,
      };
    }
  },

  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
    context: LanguageResolveContext,
  ): string | null {
    return resolvePythonImport(importingFile, source, graphFiles, context);
  },

  toPackageName(source: string): string | null {
    if (!source) return null;
    if (source.startsWith('.')) return null;
    // Package name is the first dotted segment, normalized for comparison.
    return source.split('.')[0].toLowerCase();
  },

  async preparePackageRoots(
    rootPath: string,
    files: FileEntry[],
  ): Promise<LanguageResolveContext> {
    const info = await detectPythonProject(rootPath, files);
    return {
      packageRoots: info?.packageRoots ?? [],
      meta: info ? { pythonProject: info } : undefined,
    };
  },
};

/**
 * Resolve a Python import to a repo-local file path, or null if it refers to
 * a third-party package or otherwise cannot be resolved.
 *
 * Algorithm summary:
 *   1. Absolute (`from pkg.mod.sub import x`): for each packageRoot, probe
 *      `<root>/pkg/mod/sub.py` then `<root>/pkg/mod/sub/__init__.py`.
 *   2. Relative (`from . import x` / `from .sibling import y`): count leading
 *      dots, walk that many parents from the importing file's directory,
 *      then append the remaining segments.
 *   3. If nothing matches, return null (caller classifies as third-party).
 */
function resolvePythonImport(
  importingFile: string,
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  const packageRoots = context.packageRoots ?? ['.'];

  if (source.startsWith('.')) {
    const m = /^(\.+)(.*)$/.exec(source);
    if (!m) return null;
    const dotCount = m[1].length;
    const remainder = m[2]; // may start with a `.` separator? No - the `.`s are already captured.
    const importingDir = path.posix.dirname(importingFile);
    // dotCount === 1 means "current package"; 2 means "one level up".
    let dir = importingDir;
    for (let i = 0; i < dotCount - 1; i++) {
      dir = path.posix.dirname(dir);
      if (dir === '.' || dir === '' || dir === '/') {
        dir = '';
        break;
      }
    }
    const segments = remainder ? remainder.split('.').filter(Boolean) : [];
    const base = segments.length > 0 ? [dir, ...segments].filter(Boolean).join('/') : dir;
    return probeModuleOrPackage(base, graphFiles);
  }

  // Absolute import.
  const segments = source.split('.').filter(Boolean);
  if (segments.length === 0) return null;
  for (const root of packageRoots) {
    const rootSegs = root === '.' || root === '' ? [] : root.split('/').filter(Boolean);
    const base = [...rootSegs, ...segments].join('/');
    const hit = probeModuleOrPackage(base, graphFiles);
    if (hit) return hit;
  }
  return null;
}

function probeModuleOrPackage(
  base: string,
  graphFiles: Map<string, GraphFileLike>,
): string | null {
  if (!base) return null;
  // Try `base.py` first (more specific), then `base/__init__.py`.
  const asModule = `${base}.py`;
  if (graphFiles.has(asModule)) return asModule;
  const asInit = `${base}/__init__.py`;
  if (graphFiles.has(asInit)) return asInit;
  const asPyw = `${base}.pyw`;
  if (graphFiles.has(asPyw)) return asPyw;
  return null;
}
