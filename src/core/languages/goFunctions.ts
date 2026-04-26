import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const GO_DECISION_NODES = new Set([
  'if_statement',
  'for_statement',
  'expression_case',
  'type_case',
  'communication_case',
]);

/**
 * Per-function McCabe CC for Go. Walks `function_declaration` (top-level
 * funcs) and `method_declaration` (methods on a receiver). Methods are named
 * `Receiver.Method`. Function literals (`func() { ... }`) are not extracted
 * as separate functions in 0.13.0; they fold into the enclosing function's
 * CC.
 */
export function extractGoFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, out);
  return out;
}

function walk(node: TsNode, out: FunctionInfo[]): void {
  if (node.type === 'function_declaration' || node.type === 'method_declaration') {
    const fnName = nameOfGoFunction(node);
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const cc = countDecisions(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc });
    // Don't recurse into the body for FunctionInfo - we don't track func
    // literals separately in 0.13.0 (they're not addressable by name anyway).
    return;
  }
  for (const child of node.namedChildren) walk(child, out);
}

function nameOfGoFunction(node: TsNode): string {
  // function_declaration has a `name` field (identifier).
  if (node.type === 'function_declaration') {
    const n = node.childForFieldName ? node.childForFieldName('name') : findChild(node, 'identifier');
    return n?.text ?? '<anonymous>';
  }
  // method_declaration has `receiver` + `name`. Receiver is a parameter_list.
  if (node.type === 'method_declaration') {
    const nameNode = node.childForFieldName ? node.childForFieldName('name') : findChild(node, 'field_identifier');
    const fnName = nameNode?.text ?? '<anonymous>';
    const receiver = node.childForFieldName ? node.childForFieldName('receiver') : null;
    if (receiver) {
      // Receiver text is like `(x *Foo)` or `(Foo)`. Extract the type name.
      const recvType = extractReceiverType(receiver.text);
      if (recvType) return `${recvType}.${fnName}`;
    }
    return fnName;
  }
  return '<anonymous>';
}

function extractReceiverType(text: string): string | null {
  // Strip surrounding parens; extract the last identifier-shaped token (skipping `*`).
  const inner = text.replace(/^\(|\)$/g, '').trim();
  // forms: `Foo` | `f Foo` | `f *Foo` | `*Foo` | `Foo[T]` | `f Foo[T]`
  const m = /(?:\*)?([A-Za-z_][A-Za-z0-9_]*)(?:\[[^\]]*\])?\s*$/.exec(inner);
  return m ? m[1] : null;
}

function countDecisions(fnNode: TsNode): number {
  let count = 0;
  const body = fnNode.childForFieldName ? fnNode.childForFieldName('body') : null;
  if (!body) return 1;
  walkSkipNested(body, (n) => {
    if (GO_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'binary_expression') {
      if (/(\s|^)(\|\||&&)(\s|$)/.test(n.text)) count++;
    }
  });
  return count + 1;
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'function_declaration' ||
      child.type === 'method_declaration' ||
      child.type === 'func_literal'
    ) {
      // Skip: nested function literals fold into their own implicit "function"
      // but we don't emit them. The enclosing function's CC still counts the
      // call/decision points around the literal but not those *inside* it.
      continue;
    }
    walkSkipNested(child, visit);
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) if (c.type === type) return c;
  return null;
}
