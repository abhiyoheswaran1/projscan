import { extractFunctionsFromBabel } from './astFunctionCollector.js';
import { visitTopLevel } from './astModuleSignals.js';
import { isParseable, parseBabelFile } from './astParser.js';
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

export { isParseable } from './astParser.js';

/**
 * Parse a source file and extract imports, exports, and call sites.
 *
 * Uses the Babel parser helper with generous options so we accept real-world code:
 * TypeScript, JSX, decorators, top-level await, class properties, etc.
 *
 * Failures return ok:false with a reason - callers decide whether to fall
 * back to regex or skip the file. Never throws.
 */
export function parseSource(filePath: string, content: string): AstResult {
  if (!isParseable(filePath)) {
    return { ...EMPTY, reason: 'non-source extension' };
  }

  const parsed = parseBabelFile(filePath, content);
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
