import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const PY_FUNCTION_NODES = new Set(['function_definition']);

const PY_DECISION_NODES = new Set([
  'if_statement',
  'elif_clause',
  'for_statement',
  'while_statement',
  'except_clause',
  'conditional_expression',
  'for_in_clause',
  'if_clause',
  'case_clause',
  'boolean_operator',
]);

/**
 * Per-function McCabe CC for Python. Walks function_definition nodes,
 * including those nested inside class_definition. Methods are named
 * `Class.method`. Nested functions emit their own entries; the parent's CC
 * does not include nested-function decisions.
 */
export function extractPythonFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, className: string | null, out: FunctionInfo[]): void {
  if (PY_FUNCTION_NODES.has(node.type)) {
    const nameNode = node.childForFieldName
      ? node.childForFieldName('name')
      : findChild(node, 'identifier');
    const fnName = nameNode?.text ?? '<anonymous>';
    const qualifiedName = className ? `${className}.${fnName}` : fnName;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: qualifiedName, line, endLine, cyclomaticComplexity: cc, callSites });

    // Recurse into the body to find nested functions only - the CC for THIS
    // function already correctly excluded them via the body-walker.
    const body = node.childForFieldName ? node.childForFieldName('body') : null;
    if (body) {
      for (const child of body.namedChildren) {
        walk(child, null, out);
      }
    }
    return;
  }

  if (node.type === 'class_definition') {
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

  for (const child of node.namedChildren) walk(child, className, out);
}

/**
 * Count decision points and collect call sites inside a function body,
 * skipping nested function / class definitions.
 */
function analyzeBody(fnNode: TsNode): { cc: number; callSites: string[] } {
  let count = 0;
  const calls = new Set<string>();
  const body = fnNode.childForFieldName ? fnNode.childForFieldName('body') : null;
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (PY_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'call') {
      const fn = n.childForFieldName
        ? n.childForFieldName('function')
        : (n.namedChildren[0] ?? null);
      const name = pyCalleeName(fn);
      if (name) calls.add(name);
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function pyCalleeName(node: TsNode | null): string | null {
  if (!node) return null;
  switch (node.type) {
    case 'identifier':
      return node.text;
    case 'attribute': {
      const attr = node.childForFieldName ? node.childForFieldName('attribute') : null;
      if (attr) return pyCalleeName(attr);
      const named = node.namedChildren;
      return named.length > 0 ? pyCalleeName(named[named.length - 1]) : null;
    }
    default:
      return null;
  }
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (PY_FUNCTION_NODES.has(child.type) || child.type === 'class_definition') continue;
    walkSkipNested(child, visit);
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) if (c.type === type) return c;
  return null;
}
