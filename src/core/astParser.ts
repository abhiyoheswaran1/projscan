import { parse, type ParserOptions } from '@babel/parser';
import type { File } from '@babel/types';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const JSX_EXTENSIONS = new Set(['.tsx', '.jsx']);

export type ParseBabelResult = { ok: true; ast: File } | { ok: false; reason: string };

/** Is this a file we should try to AST-parse at all? */
export function isParseable(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function parseBabelFile(filePath: string, content: string): ParseBabelResult {
  try {
    const ast = parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      errorRecovery: true,
      plugins: parserPluginsForFile(filePath),
    });
    return { ok: true, ast };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `parse error: ${msg.slice(0, 120)}` };
  }
}

function parserPluginsForFile(filePath: string): ParserOptions['plugins'] {
  const ext = path.extname(filePath).toLowerCase();
  const plugins: ParserOptions['plugins'] = [];
  if (TYPESCRIPT_EXTENSIONS.has(ext)) plugins.push('typescript');
  if (JSX_EXTENSIONS.has(ext)) plugins.push('jsx');
  plugins.push('decorators-legacy', 'dynamicImport', 'topLevelAwait');
  return plugins;
}
