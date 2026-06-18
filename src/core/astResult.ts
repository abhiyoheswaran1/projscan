import type { Program } from '@babel/types';
import { extractFunctionsFromBabel } from './astFunctionCollector.js';
import { visitTopLevel } from './astModuleSignals.js';
import { collectProgramSignals } from './astProgramSignals.js';
import type { AstExport, AstImport, FunctionInfo } from './astTypes.js';

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

const EMPTY_AST_RESULT: AstResult = {
  ok: false,
  reason: 'unparsed',
  imports: [],
  exports: [],
  callSites: [],
  lineCount: 0,
  cyclomaticComplexity: 0,
  functions: [],
};

export function unparsedAstResult(reason = 'unparsed'): AstResult {
  return { ...EMPTY_AST_RESULT, reason };
}

export function parsedAstResult(program: Program, content: string): AstResult {
  const imports: AstImport[] = [];
  const exports: AstExport[] = [];
  const callSites: string[] = [];

  for (const node of program.body) {
    visitTopLevel(node, imports, exports);
  }

  const decisionPoints = collectProgramSignals(program, imports, callSites);
  const functions = extractFunctionsFromBabel(program);

  return {
    ok: true,
    imports,
    exports,
    callSites: [...new Set(callSites)],
    lineCount: lineCountForContent(content),
    cyclomaticComplexity: decisionPoints + 1,
    functions,
  };
}

function lineCountForContent(content: string): number {
  return content ? content.split('\n').length : 0;
}
