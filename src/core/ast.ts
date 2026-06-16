import { parse, type ParserOptions } from '@babel/parser';
import type { File } from '@babel/types';
import path from 'node:path';
import { extractFunctionsFromBabel } from './astFunctionCollector.js';
import { visitTopLevel } from './astModuleSignals.js';
import { collectProgramSignals } from './astProgramSignals.js';
import type { AstExport, AstImport, FunctionInfo } from './astTypes.js';

export type { AstExport, AstImport, FunctionInfo, SymbolKind } from './astTypes.js';

export interface AstResult {
  ok: boolean;
  reason?: string;
  imports: AstImport[];
  exports: AstExport[];
  callSites: string[];
  lineCount: number;
  /** File-level McCabe cyclomatic complexity: decision points + 1. 0 when unparsed. */
  cyclomaticComplexity: number;
  /**
   * Per-function CC. May be empty when the adapter doesn't yet support
   * per-function granularity or when the file has no function definitions.
   * 0.13.0+ all six adapters populate this for parsed files.
   */
  functions: FunctionInfo[];
}

const EMPTY: AstResult = {
  ok: false,
  reason: 'unparsed',
  imports: [],
  exports: [],
  callSites: [],
  lineCount: 0,
  cyclomaticComplexity: 0,
  functions: [],
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const TYPESCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const JSX_EXTENSIONS = new Set(['.tsx', '.jsx']);

/** Is this a file we should try to AST-parse at all? */
export function isParseable(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Parse a source file and extract imports, exports, and call sites.
 *
 * Uses @babel/parser with generous options so we accept real-world code:
 * TypeScript, JSX, decorators, top-level await, class properties, etc.
 *
 * Failures return ok:false with a reason - callers decide whether to fall
 * back to regex or skip the file. Never throws.
 */
export function parseSource(filePath: string, content: string): AstResult {
  if (!isParseable(filePath)) {
    return { ...EMPTY, reason: 'non-source extension' };
  }

  const parsed = parseBabelFile(content, parserPluginsForFile(filePath));
  if (!parsed.ok) return { ...EMPTY, reason: parsed.reason };
  const ast = parsed.ast;

  const imports: AstImport[] = [];
  const exports: AstExport[] = [];
  const callSites: string[] = [];

  for (const node of ast.program.body) {
    visitTopLevel(node, imports, exports);
  }

  const decisionPoints = collectProgramSignals(ast.program, imports, callSites);

  const functions = extractFunctionsFromBabel(ast.program);

  return {
    ok: true,
    imports,
    exports,
    callSites: [...new Set(callSites)],
    lineCount: content ? content.split('\n').length : 0,
    cyclomaticComplexity: decisionPoints + 1,
    functions,
  };
}

type ParseBabelResult = { ok: true; ast: File } | { ok: false; reason: string };

function parserPluginsForFile(filePath: string): ParserOptions['plugins'] {
  const ext = path.extname(filePath).toLowerCase();
  const plugins: ParserOptions['plugins'] = [];
  if (TYPESCRIPT_EXTENSIONS.has(ext)) plugins.push('typescript');
  if (JSX_EXTENSIONS.has(ext)) plugins.push('jsx');
  plugins.push('decorators-legacy', 'dynamicImport', 'topLevelAwait');
  return plugins;
}

function parseBabelFile(content: string, plugins: ParserOptions['plugins']): ParseBabelResult {
  try {
    const ast = parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      errorRecovery: true,
      plugins,
    });
    return { ok: true, ast };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `parse error: ${msg.slice(0, 120)}` };
  }
}
