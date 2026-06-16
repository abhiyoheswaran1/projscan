import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const CSHARP_DECISION_NODES = new Set([
  'if_statement',
  'for_statement',
  'foreach_statement',
  'while_statement',
  'do_statement',
  'catch_clause',
  'conditional_expression',
]);

/**
 * Per-function McCabe CC for C#. Walks `method_declaration`,
 * `constructor_declaration`, `local_function_statement`, and
 * `destructor_declaration` nodes. Methods inside a type are named
 * `Type.method`. Lambdas (parenthesized_lambda_expression / lambda_expression)
 * fold into their enclosing function.
 */
export function extractCsharpFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, ownerName: string | null, out: FunctionInfo[]): void {
  if (
    node.type === 'class_declaration' ||
    node.type === 'struct_declaration' ||
    node.type === 'interface_declaration' ||
    node.type === 'record_declaration' ||
    node.type === 'enum_declaration'
  ) {
    const cls = nameOfType(node) ?? ownerName;
    const body = node.namedChildren.find((c) => c.type === 'declaration_list');
    if (body) {
      for (const child of body.namedChildren) walk(child, cls, out);
    }
    return;
  }

  if (
    node.type === 'namespace_declaration' ||
    node.type === 'file_scoped_namespace_declaration' ||
    node.type === 'compilation_unit' ||
    node.type === 'declaration_list'
  ) {
    for (const child of node.namedChildren) walk(child, ownerName, out);
    return;
  }

  if (
    node.type === 'method_declaration' ||
    node.type === 'constructor_declaration' ||
    node.type === 'destructor_declaration' ||
    node.type === 'local_function_statement'
  ) {
    const baseName = nameOfFn(node) ?? '<anonymous>';
    const fnName = ownerName ? `${ownerName}.${baseName}` : baseName;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc, callSites });
    return;
  }

  for (const child of node.namedChildren) walk(child, ownerName, out);
}

function analyzeBody(fnNode: TsNode): { cc: number; callSites: string[] } {
  let count = 0;
  const calls = new Set<string>();
  const body =
    fnNode.namedChildren.find((c) => c.type === 'block') ??
    fnNode.namedChildren.find((c) => c.type === 'arrow_expression_clause');
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (CSHARP_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'switch_section') {
      if (!/^\s*default\b/.test(n.text)) count++;
      return;
    }
    if (n.type === 'switch_expression_arm') {
      const t = n.text.trimStart();
      if (!/^_\s*=>/.test(t)) count++;
      return;
    }
    if (n.type === 'binary_expression') {
      if (/(\s|^)(\|\||&&|\?\?)(\s|$)/.test(n.text)) count++;
      return;
    }
    if (n.type === 'invocation_expression') {
      const name = csharpCalleeName(n);
      if (name) calls.add(name);
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function csharpCalleeName(call: TsNode): string | null {
  const fn = call.childForFieldName
    ? call.childForFieldName('function')
    : (call.namedChildren[0] ?? null);
  if (!fn) return null;
  return calleeBareName(fn);
}

function calleeBareName(node: TsNode): string | null {
  switch (node.type) {
    case 'identifier':
      return node.text;
    case 'member_access_expression':
    case 'conditional_access_expression':
    case 'member_binding_expression': {
      const name = node.childForFieldName ? node.childForFieldName('name') : null;
      if (name) return calleeBareName(name);
      const named = node.namedChildren;
      return named.length > 0 ? calleeBareName(named[named.length - 1]) : null;
    }
    case 'generic_name': {
      for (const c of node.namedChildren) {
        if (c.type === 'identifier') return c.text;
      }
      return null;
    }
    case 'qualified_name': {
      let last: string | null = null;
      for (const c of node.namedChildren) {
        if (c.type === 'identifier') last = c.text;
      }
      return last;
    }
    default:
      return null;
  }
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'method_declaration' ||
      child.type === 'constructor_declaration' ||
      child.type === 'local_function_statement' ||
      child.type === 'lambda_expression' ||
      child.type === 'parenthesized_lambda_expression' ||
      child.type === 'anonymous_method_expression'
    ) {
      // Nested fn / lambda: skip so its decisions don't double-count.
      continue;
    }
    walkSkipNested(child, visit);
  }
}

function nameOfType(node: TsNode): string | null {
  for (const c of node.namedChildren) {
    if (c.type === 'identifier') return c.text;
  }
  return null;
}

function nameOfFn(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id) return id.text;
  }
  // For methods, the name is the identifier that comes AFTER the return type.
  // For constructors / destructors, it's the only identifier child.
  let lastIdentifier: string | null = null;
  for (const c of node.namedChildren) {
    if (c.type === 'identifier') lastIdentifier = c.text;
  }
  return lastIdentifier;
}
