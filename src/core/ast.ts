import { parse, type ParserOptions } from '@babel/parser';
import type { File, Node } from '@babel/types';
import path from 'node:path';
import {
  babelCalleeName,
  babelQualifiedMemberName,
  bindingIdentifierName,
  collectMemberAliases,
  collectMemberReadIdents,
  isMemberExpressionNode,
} from './astMembers.js';
import { nameForFunctionNode } from './astFunctionNames.js';
import { visitTopLevel } from './astModuleSignals.js';
import {
  childAstNodes,
  collectProgramSignals,
  isAstNode,
  isDecisionPoint,
} from './astProgramSignals.js';
import type { AstExport, AstImport } from './astTypes.js';

export type { AstExport, AstImport, SymbolKind } from './astTypes.js';

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

/**
 * Walk a Babel program and emit one FunctionInfo per function-like node:
 * FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 * ClassMethod, ObjectMethod. Each function's CC is computed over its own
 * body only - decision points inside a nested function belong to that
 * nested function, not its parent. This matches eslint's `complexity` rule
 * and most static analyzers.
 */
function extractFunctionsFromBabel(program: Node): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  collectFunctions(program, null, null, out, null);
  return out;
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassMethod',
  'ObjectMethod',
  'ClassPrivateMethod',
]);

function isFunctionNode(n: Node): boolean {
  return FUNCTION_TYPES.has(n.type);
}

interface NodeWithLoc {
  type: string;
  loc?: { start: { line: number }; end: { line: number } };
}

function collectFunctions(
  node: Node,
  parentClassName: string | null,
  bindingName: string | null,
  out: FunctionInfo[],
  contextualCallSite: string | null,
): void {
  if (!node || typeof node !== 'object') return;

  if (isFunctionNode(node)) {
    collectFunctionInfo(node, parentClassName, bindingName, out, contextualCallSite);
    return;
  }

  if (collectClassFunctions(node, out)) return;
  if (collectVariableInitializerFunctions(node, parentClassName, out, contextualCallSite)) return;
  if (collectAssignedFunctions(node, parentClassName, out, contextualCallSite)) return;
  if (collectDefaultExportFunctions(node, parentClassName, out)) return;
  if (collectCallArgumentFunctions(node, parentClassName, out)) return;

  collectChildFunctions(node, parentClassName, out, contextualCallSite);
}

function collectFunctionInfo(
  node: Node,
  parentClassName: string | null,
  bindingName: string | null,
  out: FunctionInfo[],
  contextualCallSite: string | null,
): void {
  const name = nameForFunctionNode(node, parentClassName, bindingName);
  const line = (node as NodeWithLoc).loc?.start.line ?? 0;
  const endLine = (node as NodeWithLoc).loc?.end.line ?? line;
  const {
    cc,
    callSites,
    memberCallSites,
    directCallSites,
    memberAliases,
    memberReferences,
    references,
  } = analyzeBabelBody(node);
  const parameters = functionParamNames(node);
  out.push({
    name,
    line,
    endLine,
    cyclomaticComplexity: cc,
    callSites,
    memberCallSites,
    directCallSites,
    memberAliases,
    memberReferences,
    parameters,
    ...(contextualCallSite ? { contextualCallSite } : {}),
    references,
  });

  // Recurse into nested functions so they emit their own entries. The body
  // walker skips nested functions for CC, but we still need to find them.
  descendForNestedFunctions(node, parentClassName, out);
}

function collectClassFunctions(node: Node, out: FunctionInfo[]): boolean {
  if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') return false;
  const className = (node as { id?: { name?: string } }).id?.name ?? null;
  const body = (node as { body?: Node }).body;
  if (body) collectFunctions(body, className, null, out, null);
  return true;
}

function collectVariableInitializerFunctions(
  node: Node,
  parentClassName: string | null,
  out: FunctionInfo[],
  contextualCallSite: string | null,
): boolean {
  if (node.type !== 'VariableDeclarator') return false;
  const id = (node as { id?: { type: string; name?: string } }).id;
  const init = (node as { init?: Node | null }).init;
  const name = id && id.type === 'Identifier' ? (id.name ?? null) : null;
  if (init) collectFunctions(init, parentClassName, name, out, contextualCallSite);
  return true;
}

function collectAssignedFunctions(
  node: Node,
  parentClassName: string | null,
  out: FunctionInfo[],
  contextualCallSite: string | null,
): boolean {
  if (node.type !== 'AssignmentExpression') return false;
  const left = (node as { left?: { type: string; name?: string } }).left;
  const right = (node as { right?: Node }).right;
  const name = left && left.type === 'Identifier' ? (left.name ?? null) : null;
  if (right) collectFunctions(right, parentClassName, name, out, contextualCallSite);
  return true;
}

function collectDefaultExportFunctions(
  node: Node,
  parentClassName: string | null,
  out: FunctionInfo[],
): boolean {
  if (node.type !== 'ExportDefaultDeclaration') return false;
  const decl = (node as { declaration?: Node }).declaration;
  if (decl) collectFunctions(decl, parentClassName, 'default', out, null);
  return true;
}

function collectCallArgumentFunctions(
  node: Node,
  parentClassName: string | null,
  out: FunctionInfo[],
): boolean {
  const callContext = callExpressionContext(node);
  if (!callContext) return false;
  const args = (node as { arguments?: unknown[] }).arguments ?? [];
  for (const arg of args) collectAstChild(arg, parentClassName, out, callContext);
  return true;
}

function collectChildFunctions(
  node: Node,
  parentClassName: string | null,
  out: FunctionInfo[],
  contextualCallSite: string | null,
): void {
  for (const child of childAstNodes(node)) {
    collectFunctions(child, parentClassName, null, out, contextualCallSite);
  }
}

function collectAstChild(
  value: unknown,
  parentClassName: string | null,
  out: FunctionInfo[],
  contextualCallSite: string | null,
): void {
  if (isAstNode(value)) collectFunctions(value, parentClassName, null, out, contextualCallSite);
}

function callExpressionContext(node: Node): string | null {
  if (
    node.type !== 'CallExpression' &&
    node.type !== 'OptionalCallExpression' &&
    node.type !== 'NewExpression'
  ) {
    return null;
  }
  const callee = (node as { callee?: Node }).callee;
  return babelQualifiedMemberName(callee) ?? babelCalleeName(callee);
}

function descendForNestedFunctions(
  fnNode: Node,
  parentClassName: string | null,
  out: FunctionInfo[],
): void {
  const body = (fnNode as { body?: Node }).body;
  if (!body) return;
  // Body of a function expression/declaration is a BlockStatement (or, for
  // arrows, possibly an Expression). Either way, walk it.
  walkChildren(body, (child) => collectFunctions(child, parentClassName, null, out, null));
}

/**
 * Count McCabe decision points and collect call-site bare names in a
 * function body. Nested functions are opaque (their decisions and calls
 * belong to them). Used to populate per-function CC + fan-out.
 */
function analyzeBabelBody(fnNode: Node): {
  cc: number;
  callSites: string[];
  memberCallSites: string[];
  directCallSites: string[];
  memberAliases: string[];
  memberReferences: string[];
  references: string[];
} {
  const body = (fnNode as { body?: Node }).body;
  if (!body)
    return {
      cc: 1,
      callSites: [],
      memberCallSites: [],
      directCallSites: [],
      memberAliases: [],
      memberReferences: [],
      references: [],
    };
  const signals = createBabelBodySignals();
  walkSkippingNestedFunctions(body, (node) => collectBabelBodySignal(node, signals));
  return {
    cc: signals.decisions + 1,
    callSites: [...signals.calls],
    memberCallSites: [...signals.memberCalls],
    directCallSites: [...signals.directCalls],
    memberAliases: [...signals.aliases],
    memberReferences: [...signals.memberRefs],
    references: [...signals.refs],
  };
}

interface BabelBodySignals {
  decisions: number;
  calls: Set<string>;
  directCalls: Set<string>;
  memberCalls: Set<string>;
  aliases: Set<string>;
  memberRefs: Set<string>;
  refs: Set<string>;
  /** MemberExpression nodes in callee position belong to callSites, not references. */
  calleeMembers: Set<Node>;
}

function createBabelBodySignals(): BabelBodySignals {
  return {
    decisions: 0,
    calls: new Set<string>(),
    directCalls: new Set<string>(),
    memberCalls: new Set<string>(),
    aliases: new Set<string>(),
    memberRefs: new Set<string>(),
    refs: new Set<string>(),
    calleeMembers: new Set<Node>(),
  };
}

function collectBabelBodySignal(node: Node, signals: BabelBodySignals): void {
  if (isDecisionPoint(node)) {
    signals.decisions++;
    return;
  }
  collectBabelBodyCallSignal(node, signals);
  collectBabelBodyAliasSignal(node, signals);
  collectBabelBodyReferenceSignal(node, signals);
}

function collectBabelBodyCallSignal(node: Node, signals: BabelBodySignals): void {
  if (!isCallLikeNode(node)) return;
  const callee = (node as { callee?: Node }).callee;
  const name = babelCalleeName(callee);
  if (name) signals.calls.add(name);
  if (name && callee?.type === 'Identifier') signals.directCalls.add(name);
  const memberName = babelQualifiedMemberName(callee);
  if (memberName) signals.memberCalls.add(memberName);
  if (callee && isMemberExpressionNode(callee)) signals.calleeMembers.add(callee);
}

function collectBabelBodyAliasSignal(node: Node, signals: BabelBodySignals): void {
  if (node.type === 'VariableDeclarator') collectMemberAliases(node, signals.aliases);
}

function collectBabelBodyReferenceSignal(node: Node, signals: BabelBodySignals): void {
  if (!isMemberExpressionNode(node)) return;
  if (signals.calleeMembers.has(node)) return;
  const qualified = babelQualifiedMemberName(node);
  if (qualified) signals.memberRefs.add(qualified);
  collectMemberReadIdents(node, signals.refs);
}

function isCallLikeNode(node: Node): boolean {
  return (
    node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression' ||
    node.type === 'NewExpression'
  );
}

function functionParamNames(fnNode: Node): string[] {
  const params = (fnNode as { params?: Node[] }).params ?? [];
  const out = new Set<string>();
  for (const param of params) {
    const name = bindingIdentifierName(param);
    if (name) out.add(name);
  }
  return [...out];
}

function walkChildren(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  for (const child of childAstNodes(node)) visit(child);
}

function walkSkippingNestedFunctions(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of childAstNodes(node)) {
    if (!isFunctionNode(child)) walkSkippingNestedFunctions(child, visit);
  }
}
