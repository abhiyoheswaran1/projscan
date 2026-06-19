import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';
import { parseSource, type AstResult } from '../ast.js';
import type { GraphFileLike, LanguageAdapter, LanguageResolveContext } from './LanguageAdapter.js';

const JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

const RESOLUTION_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

interface TypeScriptPathAlias {
  pattern: string;
  targets: string[];
}

interface JavaScriptResolveMeta extends Record<string, unknown> {
  tsconfigPathAliases?: TypeScriptPathAlias[];
  tsconfigBaseUrl?: string;
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
    if (source.startsWith('.') || source.startsWith('/')) {
      const importingDir = path.posix.dirname(importingFile);
      return resolveLocalBase(path.posix.normalize(path.posix.join(importingDir, source)), graphFiles);
    }

    return resolveTsconfigPathAlias(source, graphFiles, context);
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
    const tsconfig = await loadTsconfigPathAliases(rootPath);
    return tsconfig ? { meta: tsconfig } : {};
  },
};

function resolveLocalBase(base: string, graphFiles: Map<string, GraphFileLike>): string | null {
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
}

function resolveTsconfigPathAlias(
  source: string,
  graphFiles: Map<string, GraphFileLike>,
  context: LanguageResolveContext,
): string | null {
  const meta = context.meta as JavaScriptResolveMeta | undefined;
  const aliases = meta?.tsconfigPathAliases ?? [];
  if (aliases.length === 0) return null;

  const baseUrl = normalizeRepoPath(meta?.tsconfigBaseUrl ?? '.');
  for (const alias of aliases) {
    const wildcard = matchAliasPattern(alias.pattern, source);
    if (wildcard === null) continue;

    for (const target of alias.targets) {
      const expanded = target.includes('*') ? target.replace('*', wildcard) : target;
      const candidate = normalizeRepoPath(path.posix.join(baseUrl, expanded));
      const resolved = resolveLocalBase(candidate, graphFiles);
      if (resolved) return resolved;
    }
  }
  return null;
}

function matchAliasPattern(pattern: string, source: string): string | null {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === source ? '' : null;

  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) return null;
  return source.slice(prefix.length, source.length - suffix.length);
}

async function loadTsconfigPathAliases(rootPath: string): Promise<JavaScriptResolveMeta | null> {
  try {
    const raw = await fs.readFile(path.join(rootPath, 'tsconfig.json'), 'utf-8');
    const parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(raw)) as {
      compilerOptions?: {
        baseUrl?: unknown;
        paths?: unknown;
      };
    };
    const paths = parsed.compilerOptions?.paths;
    if (!paths || typeof paths !== 'object') return null;

    const aliases: TypeScriptPathAlias[] = [];
    for (const [pattern, rawTargets] of Object.entries(paths as Record<string, unknown>)) {
      if (!Array.isArray(rawTargets)) continue;
      const targets = rawTargets.filter((target): target is string => typeof target === 'string');
      if (targets.length > 0) aliases.push({ pattern, targets });
    }
    if (aliases.length === 0) return null;

    return {
      tsconfigPathAliases: aliases,
      tsconfigBaseUrl:
        typeof parsed.compilerOptions?.baseUrl === 'string' ? parsed.compilerOptions.baseUrl : '.',
    };
  } catch {
    return null;
  }
}

function stripJsonCommentsAndTrailingCommas(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1');
}

function normalizeRepoPath(value: string): string {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  return normalized.replace(/^\.\//, '').replace(/^\/+/, '');
}
