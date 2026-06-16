import type { Node } from '@babel/types';
import type { FunctionInfo } from './astTypes.js';
import { babelCalleeName, babelQualifiedMemberName } from './astMembers.js';
import { analyzeBabelBody, functionParamNames } from './astBodySignals.js';
import { nameForFunctionNode } from './astFunctionNames.js';
import { isFunctionNode } from './astFunctionNodes.js';
import { childAstNodes, isAstNode } from './astProgramSignals.js';

/**
 * Walk a Babel program and emit one FunctionInfo per function-like node:
 * FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 * ClassMethod, ObjectMethod. Each function's CC is computed over its own
 * body only - decision points inside a nested function belong to that
 * nested function, not its parent. This matches eslint's `complexity` rule
 * and most static analyzers.
 */
export function extractFunctionsFromBabel(program: Node): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  collectFunctions(program, null, null, out, null);
  return out;
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

function walkChildren(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  for (const child of childAstNodes(node)) visit(child);
}
