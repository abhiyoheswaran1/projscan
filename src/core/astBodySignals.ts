import type { Node } from '@babel/types';
import {
  babelCalleeName,
  babelQualifiedMemberName,
  bindingIdentifierNames,
  collectMemberAliases,
  collectMemberReadIdents,
  isMemberExpressionNode,
} from './astMembers.js';
import { isFunctionNode } from './astFunctionNodes.js';
import { childAstNodes, isDecisionPoint } from './astProgramSignals.js';

export interface BabelBodyAnalysis {
  cc: number;
  callSites: string[];
  memberCallSites: string[];
  directCallSites: string[];
  memberAliases: string[];
  memberReferences: string[];
  references: string[];
}

/**
 * Count McCabe decision points and collect call-site bare names in a
 * function body. Nested functions are opaque: their decisions and calls
 * belong to their own FunctionInfo entries.
 */
export function analyzeBabelBody(fnNode: Node): BabelBodyAnalysis {
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

export function functionParamNames(fnNode: Node): string[] {
  const params = (fnNode as { params?: Node[] }).params ?? [];
  const out = new Set<string>();
  for (const param of params) {
    for (const name of bindingIdentifierNames(param)) out.add(name);
  }
  return [...out];
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

function walkSkippingNestedFunctions(node: Node, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of childAstNodes(node)) {
    if (!isFunctionNode(child)) walkSkippingNestedFunctions(child, visit);
  }
}
