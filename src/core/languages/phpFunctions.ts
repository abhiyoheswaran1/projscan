import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const PHP_DECISION_NODES = new Set([
  'if_statement',
  'else_if_clause',
  'elseif_clause',
  'for_statement',
  'foreach_statement',
  'while_statement',
  'do_statement',
  'catch_clause',
  'conditional_expression',
]);

/**
 * Per-function McCabe CC for PHP. Walks `function_definition` (free
 * functions) and `method_declaration` nodes. Methods inside `class Foo`
 * are named `Foo.method`; methods in interfaces/traits/enums use the
 * declaring type's name. Anonymous functions and closures are not
 * extracted as separate functions; their CC folds into the enclosing
 * function.
 */
export function extractPhpFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, ownerName: string | null, out: FunctionInfo[]): void {
  // Containers that scope methods by their type name.
  if (
    node.type === 'class_declaration' ||
    node.type === 'interface_declaration' ||
    node.type === 'trait_declaration' ||
    node.type === 'enum_declaration'
  ) {
    const nameNode = node.childForFieldName
      ? node.childForFieldName('name')
      : findChild(node, 'name');
    const cls = nameNode?.text ?? ownerName;
    const body = node.childForFieldName
      ? node.childForFieldName('body')
      : findChild(node, 'declaration_list');
    if (body) {
      for (const child of body.namedChildren) walk(child, cls, out);
    }
    return;
  }

  // namespace_definition wraps everything in a namespace { ... } block; descend.
  if (node.type === 'namespace_definition') {
    for (const child of node.namedChildren) walk(child, ownerName, out);
    return;
  }
  if (node.type === 'declaration_list' || node.type === 'compound_statement') {
    for (const child of node.namedChildren) walk(child, ownerName, out);
    return;
  }

  if (node.type === 'function_definition' || node.type === 'method_declaration') {
    const nameNode = node.childForFieldName
      ? node.childForFieldName('name')
      : findChild(node, 'name');
    const baseName = nameNode?.text ?? '<anonymous>';
    const fnName =
      ownerName && node.type === 'method_declaration' ? `${ownerName}.${baseName}` : baseName;
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
  const body = fnNode.childForFieldName
    ? fnNode.childForFieldName('body')
    : findChild(fnNode, 'compound_statement');
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (PHP_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'case_statement') {
      if (!/^\s*default\b/.test(n.text)) count++;
      return;
    }
    if (n.type === 'match_condition_list') {
      if (!/^\s*default\b/.test(n.text)) count++;
      return;
    }
    if (n.type === 'binary_expression') {
      const t = n.text;
      if (/(\s|^)(\|\||&&|\?\?)(\s|$)/.test(t)) count++;
      else if (/\b(and|or)\b/.test(t)) count++;
      return;
    }
    if (
      n.type === 'function_call_expression' ||
      n.type === 'member_call_expression' ||
      n.type === 'nullsafe_member_call_expression' ||
      n.type === 'scoped_call_expression'
    ) {
      const name = phpCalleeName(n);
      if (name) calls.add(name);
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function phpCalleeName(callNode: TsNode): string | null {
  const target =
    callNode.type === 'function_call_expression'
      ? callNode.childForFieldName
        ? callNode.childForFieldName('function')
        : null
      : callNode.childForFieldName
        ? callNode.childForFieldName('name')
        : null;
  if (!target) return null;
  switch (target.type) {
    case 'name':
    case 'variable_name':
      return target.text.replace(/^\$/, '');
    case 'qualified_name': {
      let last: TsNode | null = null;
      for (const c of target.namedChildren) if (c.type === 'name') last = c;
      return last ? last.text : null;
    }
    default:
      return null;
  }
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'function_definition' ||
      child.type === 'method_declaration' ||
      child.type === 'anonymous_function_creation_expression' ||
      child.type === 'arrow_function'
    ) {
      // Nested fn: skip so its decisions don't double-count into the parent.
      continue;
    }
    walkSkipNested(child, visit);
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) if (c.type === type) return c;
  return null;
}
