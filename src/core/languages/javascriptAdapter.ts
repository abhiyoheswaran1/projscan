import type { FileEntry } from '../../types.js';
import { parseSource, type AstResult } from '../ast.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';
import {
  loadJavaScriptProjectConfigs,
  resolveJavaScriptImportFromConfigs,
  type JavaScriptProjectConfig,
} from './javascriptProjectConfig.js';

const JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

interface JavaScriptResolveMeta extends Record<string, unknown> {
  projectConfigs?: JavaScriptProjectConfig[];
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
    context: LanguageResolveContext,
  ): string | null {
    const meta = context.meta as JavaScriptResolveMeta | undefined;
    return resolveJavaScriptImportFromConfigs(
      context.rootPath ?? '',
      importingFile,
      source,
      graphFiles,
      meta?.projectConfigs ?? [],
    );
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

  async preparePackageRoots(rootPath: string, _files: FileEntry[]): Promise<LanguageResolveContext> {
    const projectConfigs = await loadJavaScriptProjectConfigs(rootPath, _files);
    return { rootPath, meta: projectConfigs.length > 0 ? { projectConfigs } : undefined };
  },
};
