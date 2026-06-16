import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const JAVA_DECISION_NODES = new Set([
  'if_statement',
  'ternary_expression',
  'for_statement',
  'enhanced_for_statement',
  'while_statement',
  'do_statement',
  'catch_clause',
]);

/**
 * Per-method McCabe CC for Java. Walks `method_declaration` and
 * `constructor_declaration`. Methods are named `Class.method`; constructors
 * are named `Class.<init>`.
 */
export function extractJavaFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, className: string | null, out: FunctionInfo[]): void {
  if (
    node.type === 'class_declaration' ||
    node.type === 'interface_declaration' ||
    node.type === 'enum_declaration' ||
    node.type === 'record_declaration' ||
    node.type === 'annotation_type_declaration'
  ) {
    const nameNode = node.childForFieldName
      ? node.childForFieldName('name')
      : findChild(node, 'identifier');
    const cls = nameNode?.text ?? null;
    const body = node.childForFieldName ? node.childForFieldName('body') : null;
    if (body) {
      for (const child of body.namedChildren) {
        walk(child, cls, out);
      }
    }
    return;
  }

  if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
    const nameNode = node.childForFieldName
      ? node.childForFieldName('name')
      : findChild(node, 'identifier');
    const baseName =
      node.type === 'constructor_declaration' ? '<init>' : (nameNode?.text ?? '<anonymous>');
    const fnName = className ? `${className}.${baseName}` : baseName;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc, callSites });
    return;
  }

  for (const child of node.namedChildren) walk(child, className, out);
}

function analyzeBody(fnNode: TsNode): { cc: number; callSites: string[] } {
  let count = 0;
  const calls = new Set<string>();
  const body = fnNode.childForFieldName ? fnNode.childForFieldName('body') : null;
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (JAVA_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'switch_label' && !/^\s*default\b/.test(n.text)) {
      count++;
      return;
    }
    if (n.type === 'binary_expression' && /(\s|^)(\|\||&&)(\s|$)/.test(n.text)) {
      count++;
      return;
    }
    if (n.type === 'method_invocation') {
      const name = n.childForFieldName ? n.childForFieldName('name') : null;
      if (name) calls.add(name.text);
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'method_declaration' ||
      child.type === 'constructor_declaration' ||
      child.type === 'class_declaration' ||
      child.type === 'lambda_expression'
    ) {
      continue;
    }
    walkSkipNested(child, visit);
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) if (c.type === type) return c;
  return null;
}
