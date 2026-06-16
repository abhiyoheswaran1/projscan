import type { Node, StringLiteral } from '@babel/types';
import type { AstImport } from './astTypes.js';
import { babelCalleeName } from './astMembers.js';

export function collectProgramSignals(
  program: Node,
  imports: AstImport[],
  callSites: string[],
): number {
  let decisionPoints = 0;
  walk(program, (node) => {
    collectCallExpressionSignals(node, imports, callSites);
    if (isDecisionPoint(node)) decisionPoints++;
  });
  return decisionPoints;
}

function collectCallExpressionSignals(
  node: Node,
  imports: AstImport[],
  callSites: string[],
): void {
  if (node.type !== 'CallExpression') return;
  const callee = (node as { callee?: Node }).callee;
  const name = babelCalleeName(callee);
  if (name) callSites.push(name);
  collectCallExpressionImport(node, callee, imports);
}

function collectCallExpressionImport(
  node: Node,
  callee: Node | undefined,
  imports: AstImport[],
): void {
  const source = firstStringLiteralArgument(node);
  if (!source) return;
  if (callee?.type === 'Import') {
    imports.push(importFromCallExpression(source, 'dynamic', node));
    return;
  }
  if (callee?.type === 'Identifier' && callee.name === 'require') {
    imports.push(importFromCallExpression(source, 'require', node));
  }
}

function firstStringLiteralArgument(node: Node): string | null {
  const arg = (node as { arguments?: Node[] }).arguments?.[0];
  return arg?.type === 'StringLiteral' ? (arg as StringLiteral).value : null;
}

function importFromCallExpression(
  source: string,
  kind: 'dynamic' | 'require',
  node: Node,
): AstImport {
  return {
    source,
    kind,
    specifiers: [],
    typeOnly: false,
    line: (node as NodeWithLoc).loc?.start.line ?? 0,
  };
}

const NON_CHILD_KEYS = new Set(['loc', 'range', 'leadingComments', 'trailingComments']);

export function childAstNodes(node: Node): Node[] {
  const children: Node[] = [];
  for (const key of Object.keys(node)) {
    if (NON_CHILD_KEYS.has(key)) continue;
    children.push(...astNodesFromValue((node as unknown as Record<string, unknown>)[key]));
  }
  return children;
}

function astNodesFromValue(value: unknown): Node[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(isAstNode);
  return isAstNode(value) ? [value] : [];
}

export function isAstNode(value: unknown): value is Node {
  return Boolean(value && typeof value === 'object' && 'type' in value);
}

const DECISION_NODE_TYPES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
]);
const DECISION_LOGICAL_OPERATORS = new Set(['&&', '||', '??']);

/**
 * McCabe decision points for JavaScript/TypeScript. Default switch cases and
 * optional-chaining do NOT count - this matches eslint's `complexity` rule
 * and most static analyzers.
 */
export function isDecisionPoint(n: Node): boolean {
  if (DECISION_NODE_TYPES.has(n.type)) return true;
  if (n.type === 'SwitchCase') return (n as { test: unknown }).test !== null;
  if (n.type !== 'LogicalExpression') return false;
  return DECISION_LOGICAL_OPERATORS.has((n as { operator: string }).operator);
}

function walk(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of childAstNodes(node)) walk(child, visit);
}

interface NodeWithLoc {
  type: string;
  loc?: { start: { line: number }; end: { line: number } };
}
