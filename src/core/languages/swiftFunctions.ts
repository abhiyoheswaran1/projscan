import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const SWIFT_DECISION_NODES = new Set([
  'if_statement',
  'guard_statement',
  'for_statement',
  'while_statement',
  'repeat_while_statement',
  'do_statement',
  'catch_block',
  'catch_clause',
]);

/**
 * Per-function McCabe CC for Swift. Walks `function_declaration` nodes
 * (top-level + class/struct/protocol/extension methods). Methods inside
 * `class Foo { func m() }` are named `Foo.m`. Closures and trailing-closure
 * blocks aren't extracted as separate functions; their decision points
 * fold into the enclosing function (matches projscan's convention for
 * Rust closures and Go func literals).
 *
 * `switch` cases each count as +1; the `default` arm does not. Optional
 * chaining (`?.`) and nil-coalescing (`??`) are NOT counted.
 */
export function extractSwiftFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, ownerName: string | null, out: FunctionInfo[]): void {
  if (
    node.type === 'class_declaration' ||
    node.type === 'protocol_declaration' ||
    node.type === 'extension_declaration'
  ) {
    const name = nameOfDecl(node) ?? ownerName;
    const body = bodyOf(node);
    if (body) {
      for (const child of body.namedChildren) walk(child, name, out);
    }
    return;
  }

  if (
    node.type === 'function_declaration' ||
    node.type === 'init_declaration' ||
    node.type === 'deinit_declaration' ||
    node.type === 'subscript_declaration'
  ) {
    let baseName: string;
    if (node.type === 'init_declaration') baseName = 'init';
    else if (node.type === 'deinit_declaration') baseName = 'deinit';
    else if (node.type === 'subscript_declaration') baseName = 'subscript';
    else baseName = nameOfDecl(node) ?? '<anonymous>';
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
      c.type === 'protocol_body' ||
      c.type === 'function_body' ||
      c.type === 'extension_body'
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
    if (SWIFT_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'switch_entry') {
      // The default arm has no value child (no case_label patterns) — non-
      // default arms always carry one or more case_label / case_pattern
      // children. Mirrors the kotlin/cpp structural-detection approach.
      const isDefault = !n.namedChildren.some((c) => c.type === 'switch_pattern' || c.type === 'case_label');
      if (!isDefault) count++;
      return;
    }
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
      const last = node.namedChildren[node.namedChildren.length - 1];
      return last ? bareName(last) : null;
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
      child.type === 'init_declaration' ||
      child.type === 'class_declaration' ||
      child.type === 'protocol_declaration' ||
      child.type === 'lambda_literal' ||
      child.type === 'closure_expression'
    ) {
      continue;
    }
    walkSkipNested(child, visit);
  }
}
