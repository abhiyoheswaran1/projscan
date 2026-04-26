import { parse, type ParserOptions } from '@babel/parser';
import type {
  File,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportAllDeclaration,
  Statement,
  VariableDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  TSEnumDeclaration,
  Identifier,
  StringLiteral,
  Node,
} from '@babel/types';
import path from 'node:path';

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

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

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

  const ext = path.extname(filePath).toLowerCase();
  const isTypeScript = ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts';
  const isJSX = ext === '.tsx' || ext === '.jsx';

  const plugins: ParserOptions['plugins'] = [];
  if (isTypeScript) plugins.push('typescript');
  if (isJSX) plugins.push('jsx');
  plugins.push('decorators-legacy', 'dynamicImport', 'topLevelAwait');

  let ast: File;
  try {
    ast = parse(content, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      errorRecovery: true,
      plugins,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...EMPTY, reason: `parse error: ${msg.slice(0, 120)}` };
  }

  const imports: AstImport[] = [];
  const exports: AstExport[] = [];
  const callSites: string[] = [];
  let decisionPoints = 0;

  for (const node of ast.program.body) {
    visitTopLevel(node, imports, exports);
  }

  // Second pass: extract dynamic imports + call sites + cyclomatic decision
  // points. Walk the whole tree (cheap - we already have the AST in memory).
  walk(ast.program, (n) => {
    if (n.type === 'CallExpression') {
      const callee = n.callee;
      if (callee.type === 'Identifier') {
        callSites.push(callee.name);
      } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        callSites.push(callee.property.name);
      } else if (callee.type === 'Import' && n.arguments[0] && n.arguments[0].type === 'StringLiteral') {
        imports.push({
          source: n.arguments[0].value,
          kind: 'dynamic',
          specifiers: [],
          typeOnly: false,
          line: n.loc?.start.line ?? 0,
        });
      }
      // CommonJS require()
      if (
        callee.type === 'Identifier' &&
        callee.name === 'require' &&
        n.arguments[0] &&
        n.arguments[0].type === 'StringLiteral'
      ) {
        imports.push({
          source: n.arguments[0].value,
          kind: 'require',
          specifiers: [],
          typeOnly: false,
          line: n.loc?.start.line ?? 0,
        });
      }
    }
    if (isDecisionPoint(n)) decisionPoints++;
  });

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
  collectFunctions(program, null, null, out);
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
): void {
  if (!node || typeof node !== 'object') return;

  if (isFunctionNode(node)) {
    const name = nameForFunctionNode(node, parentClassName, bindingName);
    const line = (node as NodeWithLoc).loc?.start.line ?? 0;
    const endLine = (node as NodeWithLoc).loc?.end.line ?? line;
    const cc = countCcInBody(node);
    out.push({ name, line, endLine, cyclomaticComplexity: cc });

    // Recurse into nested functions so they emit their own entries. The body
    // walker (`countCcInBody`) skips nested functions for CC, but we still need
    // to descend the whole tree to find all functions.
    descendForNestedFunctions(node, parentClassName, out);
    return;
  }

  // Track context so nested functions get a useful name.
  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
    const className = (node as { id?: { name?: string } }).id?.name ?? null;
    const body = (node as { body?: Node }).body;
    if (body) collectFunctions(body, className, null, out);
    return;
  }

  if (node.type === 'VariableDeclarator') {
    const id = (node as { id?: { type: string; name?: string } }).id;
    const init = (node as { init?: Node | null }).init;
    const name = id && id.type === 'Identifier' ? (id.name ?? null) : null;
    if (init) collectFunctions(init, parentClassName, name, out);
    return;
  }

  if (node.type === 'AssignmentExpression') {
    const left = (node as { left?: { type: string; name?: string } }).left;
    const right = (node as { right?: Node }).right;
    const name = left && left.type === 'Identifier' ? (left.name ?? null) : null;
    if (right) collectFunctions(right, parentClassName, name, out);
    return;
  }

  if (node.type === 'ExportDefaultDeclaration') {
    const decl = (node as { declaration?: Node }).declaration;
    if (decl) collectFunctions(decl, parentClassName, 'default', out);
    return;
  }

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'leadingComments' || key === 'trailingComments') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          collectFunctions(item as Node, parentClassName, null, out);
        }
      }
    } else if (typeof child === 'object' && 'type' in child) {
      collectFunctions(child as Node, parentClassName, null, out);
    }
  }
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
  walkChildren(body, (child) => collectFunctions(child, parentClassName, null, out));
}

function nameForFunctionNode(
  node: Node,
  parentClassName: string | null,
  bindingName: string | null,
): string {
  // FunctionDeclaration: function foo() {}
  if (node.type === 'FunctionDeclaration') {
    const id = (node as { id?: { name?: string } }).id;
    return id?.name ?? bindingName ?? '<anonymous>';
  }
  // ClassMethod / ObjectMethod / ClassPrivateMethod
  if (node.type === 'ClassMethod' || node.type === 'ObjectMethod' || node.type === 'ClassPrivateMethod') {
    const key = (node as { key?: { type: string; name?: string; value?: string } }).key;
    let methodName = '<anonymous>';
    if (key) {
      if (key.type === 'Identifier') methodName = key.name ?? '<anonymous>';
      else if (key.type === 'StringLiteral') methodName = key.value ?? '<anonymous>';
      else if (key.type === 'PrivateName') {
        const inner = (key as unknown as { id?: { name?: string } }).id;
        methodName = inner?.name ? `#${inner.name}` : '<anonymous>';
      }
    }
    return parentClassName ? `${parentClassName}.${methodName}` : methodName;
  }
  // FunctionExpression with an inner id: const x = function named() {}
  if (node.type === 'FunctionExpression') {
    const id = (node as { id?: { name?: string } }).id;
    if (id?.name) return id.name;
  }
  // Arrow / unnamed function expression: use the binding name if we have it.
  return bindingName ?? '<anonymous>';
}

/**
 * Count McCabe decision points in a function body, treating nested functions
 * as opaque (their decision points belong to them, not the enclosing function).
 */
function countCcInBody(fnNode: Node): number {
  const body = (fnNode as { body?: Node }).body;
  if (!body) return 1;
  let decisions = 0;
  walkSkippingNestedFunctions(body, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function walkChildren(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'leadingComments' || key === 'trailingComments') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) visit(item as Node);
      }
    } else if (typeof child === 'object' && 'type' in child) {
      visit(child as Node);
    }
  }
}

function walkSkippingNestedFunctions(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'leadingComments' || key === 'trailingComments') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          if (isFunctionNode(item as Node)) continue;
          walkSkippingNestedFunctions(item as Node, visit);
        }
      }
    } else if (typeof child === 'object' && 'type' in child) {
      if (isFunctionNode(child as Node)) continue;
      walkSkippingNestedFunctions(child as Node, visit);
    }
  }
}

/**
 * McCabe decision points for JavaScript/TypeScript. Default switch cases and
 * optional-chaining do NOT count - this matches eslint's `complexity` rule
 * and most static analyzers. The result is summed across the whole file
 * (module + all nested functions) and offset by +1 in the caller.
 */
function isDecisionPoint(n: Node): boolean {
  switch (n.type) {
    case 'IfStatement':
    case 'ConditionalExpression':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'CatchClause':
      return true;
    case 'SwitchCase':
      // Default case is the fall-through path, not a branch.
      return (n as { test: unknown }).test !== null;
    case 'LogicalExpression': {
      const op = (n as { operator: string }).operator;
      return op === '&&' || op === '||' || op === '??';
    }
    default:
      return false;
  }
}

function visitTopLevel(
  node: Statement,
  imports: AstImport[],
  exports: AstExport[],
): void {
  switch (node.type) {
    case 'ImportDeclaration': {
      imports.push(importFromNode(node));
      return;
    }
    case 'ExportNamedDeclaration': {
      collectNamedExport(node, exports, imports);
      return;
    }
    case 'ExportDefaultDeclaration': {
      exports.push({
        name: 'default',
        kind: 'default',
        typeOnly: false,
        line: node.loc?.start.line ?? 0,
      });
      return;
    }
    case 'ExportAllDeclaration': {
      const source = (node as ExportAllDeclaration).source.value;
      imports.push({
        source,
        kind: 'reexport',
        specifiers: [],
        typeOnly: Boolean((node as { exportKind?: string }).exportKind === 'type'),
        line: node.loc?.start.line ?? 0,
      });
      return;
    }
    default:
      return;
  }
}

function importFromNode(node: ImportDeclaration): AstImport {
  const specifiers = node.specifiers.map((s) => {
    if (s.type === 'ImportDefaultSpecifier') return 'default';
    if (s.type === 'ImportNamespaceSpecifier') return '*';
    if (s.type === 'ImportSpecifier') {
      const imported = s.imported;
      if (imported.type === 'Identifier') return imported.name;
      return (imported as StringLiteral).value;
    }
    return '';
  });
  return {
    source: (node.source as StringLiteral).value,
    kind: 'static',
    specifiers: specifiers.filter(Boolean),
    typeOnly: node.importKind === 'type',
    line: node.loc?.start.line ?? 0,
  };
}

function collectNamedExport(
  node: ExportNamedDeclaration,
  exports: AstExport[],
  imports: AstImport[],
): void {
  // Re-export: export { X } from 'source'
  if (node.source) {
    imports.push({
      source: (node.source as StringLiteral).value,
      kind: 'reexport',
      specifiers: node.specifiers.map((s) => {
        if (s.type === 'ExportSpecifier') {
          const exported = s.exported;
          return exported.type === 'Identifier' ? exported.name : (exported as StringLiteral).value;
        }
        return '';
      }).filter(Boolean),
      typeOnly: node.exportKind === 'type',
      line: node.loc?.start.line ?? 0,
    });
  }

  // Inline declaration: export function foo() {} / export const x = ... / etc.
  if (node.declaration) {
    const typeOnly = node.exportKind === 'type';
    const line = node.declaration.loc?.start.line ?? node.loc?.start.line ?? 0;
    switch (node.declaration.type) {
      case 'FunctionDeclaration': {
        const name = (node.declaration as FunctionDeclaration).id?.name;
        if (name) exports.push({ name, kind: 'function', typeOnly, line });
        return;
      }
      case 'ClassDeclaration': {
        const name = (node.declaration as ClassDeclaration).id?.name;
        if (name) exports.push({ name, kind: 'class', typeOnly, line });
        return;
      }
      case 'VariableDeclaration': {
        for (const decl of (node.declaration as VariableDeclaration).declarations) {
          if (decl.id.type === 'Identifier') {
            exports.push({ name: (decl.id as Identifier).name, kind: 'variable', typeOnly, line });
          }
        }
        return;
      }
      case 'TSInterfaceDeclaration': {
        const name = (node.declaration as TSInterfaceDeclaration).id.name;
        exports.push({ name, kind: 'interface', typeOnly: true, line });
        return;
      }
      case 'TSTypeAliasDeclaration': {
        const name = (node.declaration as TSTypeAliasDeclaration).id.name;
        exports.push({ name, kind: 'type', typeOnly: true, line });
        return;
      }
      case 'TSEnumDeclaration': {
        const name = (node.declaration as TSEnumDeclaration).id.name;
        exports.push({ name, kind: 'enum', typeOnly, line });
        return;
      }
      default:
        return;
    }
  }

  // Named re-export of local symbols: export { foo, bar }
  for (const spec of node.specifiers) {
    if (spec.type !== 'ExportSpecifier') continue;
    const exported = spec.exported;
    const name = exported.type === 'Identifier' ? exported.name : (exported as StringLiteral).value;
    exports.push({
      name,
      kind: 'unknown',
      typeOnly: node.exportKind === 'type',
      line: spec.loc?.start.line ?? node.loc?.start.line ?? 0,
    });
  }
}

/**
 * Lightweight AST walker. We only care about recursing through node properties
 * to find CallExpressions (for call sites + dynamic imports + require).
 * Avoids the full babel-traverse dependency.
 */
function walk(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'leadingComments' || key === 'trailingComments') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          walk(item as Node, visit);
        }
      }
    } else if (typeof child === 'object' && 'type' in child) {
      walk(child as Node, visit);
    }
  }
}
