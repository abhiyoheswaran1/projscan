import { isParseable, parseBabelFile } from './astParser.js';
import { parsedAstResult, unparsedAstResult, type AstResult } from './astResult.js';

export type { AstExport, AstImport, FunctionInfo, SymbolKind } from './astTypes.js';
export type { AstResult } from './astResult.js';

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
    return unparsedAstResult('non-source extension');
  }

  const parsed = parseBabelFile(filePath, content);
  if (!parsed.ok) return unparsedAstResult(parsed.reason);
  return parsedAstResult(parsed.ast.program, content);
}
