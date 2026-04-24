import path from 'node:path';
import type { FileEntry } from '../../types.js';
import { parseSource, type AstResult } from '../ast.js';
import type {
  GraphFileLike,
  LanguageAdapter,
  LanguageResolveContext,
} from './LanguageAdapter.js';

const JS_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
]);

const RESOLUTION_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

const NODE_BUILTINS = new Set([
  'assert','async_hooks','buffer','child_process','cluster','console','constants','crypto',
  'dgram','dns','domain','events','fs','fs/promises','http','http2','https','inspector',
  'module','net','os','path','perf_hooks','process','punycode','querystring','readline',
  'repl','stream','string_decoder','sys','timers','tls','trace_events','tty','url','util',
  'v8','vm','wasi','worker_threads','zlib',
]);

export const javascriptAdapter: LanguageAdapter = {
  id: 'javascript',
  extensions: JS_EXTENSIONS,
  sourceExtensions: JS_EXTENSIONS,
  barrelBasenames: new Set(['index']),

  parse(filePath: string, content: string): AstResult {
    return parseSource(filePath, content);
  },

  resolveImport(
    importingFile: string,
    source: string,
    graphFiles: Map<string, GraphFileLike>,
  ): string | null {
    if (!(source.startsWith('.') || source.startsWith('/'))) return null;
    const importingDir = path.posix.dirname(importingFile);
    const base = path.posix.normalize(path.posix.join(importingDir, source));

    if (graphFiles.has(base)) return base;

    for (const ext of RESOLUTION_EXTS) {
      if (graphFiles.has(base + ext)) return base + ext;
    }
    for (const ext of RESOLUTION_EXTS) {
      const barrel = `${base}/index${ext}`;
      if (graphFiles.has(barrel)) return barrel;
    }

    if (base.endsWith('.js')) {
      const trimmed = base.slice(0, -3);
      if (graphFiles.has(`${trimmed}.ts`)) return `${trimmed}.ts`;
      if (graphFiles.has(`${trimmed}.tsx`)) return `${trimmed}.tsx`;
    }
    return null;
  },

  toPackageName(specifier: string): string | null {
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
  },

  preparePackageRoots(_rootPath: string, _files: FileEntry[]): LanguageResolveContext {
    return {};
  },
};
