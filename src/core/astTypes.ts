export type SymbolKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'type'
  | 'interface'
  | 'enum'
  | 'default'
  | 'unknown';

export interface AstImport {
  source: string;
  kind: 'static' | 'dynamic' | 'require' | 'reexport';
  specifiers: string[];
  typeOnly: boolean;
  line: number;
}

export interface AstExport {
  name: string;
  kind: SymbolKind;
  typeOnly: boolean;
  line: number;
}

/**
 * Per-function cyclomatic complexity entry. `name` is qualified with the
 * containing class for methods (`Class.method`), bare for top-level functions,
 * and `<anonymous>` for unnamed function expressions / arrows assigned to
 * non-trivially-named bindings.
 */
export interface FunctionInfo {
  name: string;
  /** 1-based start line (function keyword / arrow). */
  line: number;
  /** 1-based end line. Equal to `line` for adapters that don't track end. */
  endLine: number;
  cyclomaticComplexity: number;
  /**
   * Approximate per-function fan-in (0.15.0+): count of OTHER files whose
   * `callSites` includes this function's bare name. Populated post-parse in
   * `buildCodeGraph`; absent right after `parse()` since it requires the
   * full graph. Name-based: shared function names across files cannot be
   * disambiguated and will be attributed to all definitions.
   */
  fanIn?: number;
  /**
   * Per-function call sites (1.2.0+): bare names of functions called from
   * within this function's body. Nested functions / lambdas are NOT
   * included (their calls fold into their own entries). Populated by each
   * language adapter's per-function walker.
   */
  callSites?: string[];
  /**
   * Qualified member call sites for JavaScript/TypeScript functions, such as
   * `request.json` or `db.query`. Bare `callSites` remains the stable
   * cross-language field; this keeps receiver-sensitive checks precise.
   */
  memberCallSites?: string[];
  /** Function parameter names when the adapter can recover them. */
  parameters?: string[];
  /** Bare identifier call sites, excluding member calls like cache.query(). */
  directCallSites?: string[];
  /** Local aliases for member functions, e.g. query=pool.query from const { query } = pool. */
  memberAliases?: string[];
  /** Qualified call expression this function was passed to, e.g. app.post for Express callbacks. */
  contextualCallSite?: string;
  /**
   * Per-function fan-out (1.2.0+): count of distinct callee names from
   * `callSites`, restricted to names that are defined as functions
   * SOMEWHERE in the graph. External / library / unresolved calls do not
   * count. Populated post-parse in `buildCodeGraph`.
   */
  fanOut?: number;
  /**
   * Per-function member-expression reads (1.6.0+): rightmost identifier
   * of every `obj.prop` chain in the function body that is NOT in callee
   * position. Used by taint analysis to detect property-shaped sources
   * like `process.env.X` (captures `env` and `X`). Currently only the
   * JavaScript/TypeScript adapter populates this; other adapters omit
   * it and taint will only match call-shaped sources for those files.
   */
  references?: string[];
  /**
   * Qualified member-expression reads for JavaScript/TypeScript functions,
   * e.g. `ctx.request.body`. Used when bare references are too ambiguous.
   */
  memberReferences?: string[];
}
