import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const KOTLIN_DECISION_NODES = new Set([
  'if_expression',
  'for_statement',
  'while_statement',
  'do_while_statement',
  'try_expression',
  'catch_block',
]);

/**
 * Per-function McCabe CC for Kotlin. Walks `function_declaration` nodes
 * (top-level functions and class methods). Methods inside `class Foo { fun m() }`
 * are named `Foo.m`; top-level functions stay bare. Anonymous functions and
 * lambdas are not extracted as separate entries; their decision points fold
 * into the enclosing function (analogous to JS arrow/closure handling
 * elsewhere in projscan).
 *
 * `when` expressions count one branch per non-else arm.
 */
export function extractKotlinFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, ownerName: string | null, out: FunctionInfo[]): void {
  if (
    node.type === 'class_declaration' ||
    node.type === 'object_declaration'
  ) {
    const name = nameOfDecl(node) ?? ownerName;
    const body = bodyOf(node);
    if (body) {
      for (const child of body.namedChildren) walk(child, name, out);
    }
    return;
  }

  if (node.type === 'function_declaration') {
    const baseName = nameOfDecl(node) ?? '<anonymous>';
    const fnName = ownerName ? `${ownerName}.${baseName}` : baseName;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc, callSites });
    return;
  }

  for (const child of node.namedChildren) walk(child, ownerName, out);
}

function nameOfDecl(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id && id.text) return id.text;
  }
  for (const c of node.namedChildren) {
    if (c.type === 'simple_identifier' || c.type === 'identifier' || c.type === 'type_identifier') {
      return c.text;
    }
  }
  return null;
}

function bodyOf(node: TsNode): TsNode | null {
  if (node.childForFieldName) {
    const b = node.childForFieldName('body');
    if (b) return b;
  }
  for (const c of node.namedChildren) {
    if (
      c.type === 'class_body' ||
      c.type === 'enum_class_body' ||
      c.type === 'function_body'
    ) {
      return c;
    }
  }
  return null;
}

function analyzeBody(fnNode: TsNode): { cc: number; callSites: string[] } {
  let count = 0;
  const calls = new Set<string>();
  const body = bodyOf(fnNode);
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (KOTLIN_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    // when expressions: each non-else entry counts as a branch.
    if (n.type === 'when_entry') {
      // Non-else arms have ≥1 `when_condition` child; the `else` arm has none
      // (the `else` keyword is anonymous in tree-sitter-kotlin's grammar).
      const hasCondition = n.namedChildren.some((c) => c.type === 'when_condition');
      if (hasCondition) count++;
      return;
    }
    // && / ||
    if (n.type === 'conjunction_expression' || n.type === 'disjunction_expression') {
      count++;
      return;
    }
    if (n.type === 'call_expression') {
      const fn = n.childForFieldName ? n.childForFieldName('function') : n.namedChildren[0] ?? null;
      const name = bareName(fn);
      if (name) calls.add(name);
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function bareName(node: TsNode | null): string | null {
  if (!node) return null;
  switch (node.type) {
    case 'simple_identifier':
    case 'identifier':
    case 'type_identifier':
      return node.text;
    case 'navigation_expression': {
      // a.b.c → take the last suffix
      const named = node.namedChildren;
      return named.length > 0 ? bareName(named[named.length - 1]) : null;
    }
    case 'navigation_suffix': {
      for (const c of node.namedChildren) {
        const n = bareName(c);
        if (n) return n;
      }
      return null;
    }
    default:
      return null;
  }
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'function_declaration' ||
      child.type === 'class_declaration' ||
      child.type === 'object_declaration' ||
      child.type === 'lambda_literal' ||
      child.type === 'anonymous_function'
    ) {
      continue;
    }
    walkSkipNested(child, visit);
  }
}

