import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import { extractImports } from './fileInspector.js';

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB — skip giant generated files

export interface ImportGraph {
  /** file → set of import specifiers exactly as they appear in source */
  byFile: Map<string, Set<string>>;
  /** unique set of non-relative, non-builtin specifiers (package names) */
  externalPackages: Set<string>;
  /** count of source files scanned */
  scannedFiles: number;
}

const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

/**
 * Walk source files and build an import graph. Extracts ES imports and
 * CommonJS requires; falls back silently on unreadable / oversized files.
 */
export async function buildImportGraph(
  rootPath: string,
  files: FileEntry[],
): Promise<ImportGraph> {
  const byFile = new Map<string, Set<string>>();
  const externalPackages = new Set<string>();
  let scannedFiles = 0;

  const sourceFiles = files.filter(
    (f) => SOURCE_EXTENSIONS.has(f.extension) && f.sizeBytes <= MAX_FILE_SIZE,
  );

  await Promise.all(
    sourceFiles.map(async (file) => {
      const abs = path.isAbsolute(file.absolutePath)
        ? file.absolutePath
        : path.resolve(rootPath, file.relativePath);
      let content: string;
      try {
        content = await fs.readFile(abs, 'utf-8');
      } catch {
        return;
      }
      scannedFiles++;
      const imports = extractImports(content);
      const specifiers = new Set<string>();
      for (const imp of imports) {
        specifiers.add(imp.source);
        const pkg = toPackageName(imp.source);
        if (pkg && !NODE_BUILTINS.has(pkg) && !pkg.startsWith('node:')) {
          externalPackages.add(pkg);
        }
      }
      byFile.set(file.relativePath, specifiers);
    }),
  );

  return { byFile, externalPackages, scannedFiles };
}

/**
 * Convert an import specifier to a bare package name.
 * Returns null for relative paths ("./", "../", "/"), node: builtins, and bare builtins.
 *
 *   'react'           -> 'react'
 *   'react/jsx-runtime' -> 'react'
 *   '@types/node'     -> '@types/node'
 *   '@scope/pkg/deep' -> '@scope/pkg'
 *   './local'         -> null
 *   'node:fs'         -> null
 *   'fs'              -> null (node builtin)
 */
export function toPackageName(specifier: string): string | null {
  if (!specifier) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:')) return null;
  if (NODE_BUILTINS.has(specifier)) return null;

  if (specifier.startsWith('@')) {
    const segments = specifier.split('/');
    if (segments.length < 2) return null;
    return `${segments[0]}/${segments[1]}`;
  }

  return specifier.split('/')[0];
}

/** Check if a package is referenced by at least one file in the graph. */
export function isPackageUsed(graph: ImportGraph, pkg: string): boolean {
  return graph.externalPackages.has(pkg);
}

/** List files that import a given package. */
export function filesImporting(graph: ImportGraph, pkg: string): string[] {
  const out: string[] = [];
  for (const [file, specifiers] of graph.byFile) {
    for (const spec of specifiers) {
      if (toPackageName(spec) === pkg) {
        out.push(file);
        break;
      }
    }
  }
  return out.sort();
}
