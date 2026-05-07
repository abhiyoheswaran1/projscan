import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const CPP_DECISION_NODES = new Set([
  'if_statement',
  'for_statement',
  'for_range_loop',
  'while_statement',
  'do_statement',
  'try_statement',
  'catch_clause',
]);

const CPP_STATEMENT_NODES = new Set([
  'return_statement',
  'break_statement',
  'continue_statement',
  'expression_statement',
  'compound_statement',
  'if_statement',
  'for_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'goto_statement',
  'declaration',
  'labeled_statement',
]);

/**
 * Per-function McCabe CC for C++. Walks `function_definition` nodes
 * (free functions, methods defined out-of-line, lambdas are NOT
 * extracted as separate entries; their decisions fold into the
 * enclosing function — matches the convention used elsewhere).
 *
 * Member functions defined inside a class body are named `Class.method`.
 * Out-of-line definitions (`void Foo::bar() { ... }`) are also named
 * `Foo.bar` based on the qualified declarator.
 *
 * `case` labels each contribute +1; `default:` does not. Ternaries (`?:`)
 * count as +1. Logical `&&` and `||` each count.
 */
export function extractCppFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, ownerName: string | null, out: FunctionInfo[]): void {
  if (
    node.type === 'class_specifier' ||
    node.type === 'struct_specifier' ||
    node.type === 'union_specifier'
  ) {
    const name = nameOfDecl(node) ?? ownerName;
    const body = bodyOf(node);
    if (body) {
      for (const child of body.namedChildren) walk(child, name, out);
    }
    return;
  }

  if (node.type === 'namespace_definition' || node.type === 'linkage_specification') {
    const body = bodyOf(node);
    if (body) {
      for (const child of body.namedChildren) walk(child, ownerName, out);
    }
    return;
  }

  if (node.type === 'function_definition') {
    const baseName = functionName(node) ?? '<anonymous>';
    // If the name already has `::` (out-of-line method), translate to dot form
    // and use that as the qualified name. Otherwise prepend ownerName if any.
    // 1.8+ — translate `::` ONLY when it appears outside angle-bracket
    // depth, so a templated method declarator like `Foo<std::pair<int,int>>::bar`
    // doesn't get its inner template's `::` rewritten.
    let fnName: string;
    if (baseName.includes('::')) {
      fnName = translateScopeOperator(baseName);
    } else {
      fnName = ownerName ? `${ownerName}.${baseName}` : baseName;
    }
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc, callSites });
    return;
  }

  for (const child of node.namedChildren) walk(child, ownerName, out);
}

function functionName(fn: TsNode): string | null {
  // Walk into the function_declarator to find the identifier / qualified_identifier.
  if (fn.childForFieldName) {
    const dec = fn.childForFieldName('declarator');
    if (dec) return declaratorName(dec);
  }
  for (const c of fn.namedChildren) {
    if (c.type === 'function_declarator') return declaratorName(c);
  }
  return null;
}

/**
 * Translate `::` → `.` only when it's at angle-bracket depth 0. Inside
 * a template-argument list (e.g., `std::pair<int,int>`) the `::` belongs
 * to a type qualifier, not to the method's enclosing scope, and must
 * not be rewritten. Without this, `Foo<std::pair<int,int>>::bar` would
 * become `Foo<std.pair<int,int>>.bar`, corrupting the type spelling.
 */
function translateScopeOperator(s: string): string {
  let out = '';
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '<') {
      depth += 1;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '>') {
      if (depth > 0) depth -= 1;
      out += ch;
      i += 1;
      continue;
    }
    if (depth === 0 && ch === ':' && s[i + 1] === ':') {
      out += '.';
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function declaratorName(node: TsNode): string | null {
  if (
    node.type === 'identifier' ||
    node.type === 'field_identifier' ||
    node.type === 'type_identifier' ||
    node.type === 'destructor_name'
  ) {
    return node.text;
  }
  if (node.type === 'qualified_identifier') {
    // e.g., `Foo::bar` — emit as-is; caller will translate `::` → `.`.
    const text = node.text.replace(/\s+/g, '');
    return text;
  }
  if (node.type === 'operator_name') {
    return node.text.replace(/\s+/g, '');
  }
  if (node.childForFieldName) {
    const inner = node.childForFieldName('declarator');
    if (inner) return declaratorName(inner);
  }
  for (const c of node.namedChildren) {
    const r = declaratorName(c);
    if (r) return r;
  }
  return null;
}

function nameOfDecl(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id && id.text) return id.text;
  }
  for (const c of node.namedChildren) {
    if (c.type === 'type_identifier' || c.type === 'identifier') return c.text;
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
      c.type === 'compound_statement' ||
      c.type === 'field_declaration_list' ||
      c.type === 'declaration_list' ||
      c.type === 'enumerator_list'
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
    if (CPP_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'case_statement') {
      // `case X:` has a `value` field; `default:` does not. Field-based
      // detection avoids text-regex fragility around comments / whitespace.
      const hasValue = n.childForFieldName ? !!n.childForFieldName('value') : false;
      if (hasValue) {
        count++;
      } else {
        // Fallback for grammar versions without the field: the first named
        // child of a `case X:` is the value node (literal / identifier);
        // `default:` puts the statement first instead.
        const first = n.namedChildren[0];
        if (first && !CPP_STATEMENT_NODES.has(first.type)) count++;
      }
      return;
    }
    if (n.type === 'conditional_expression') {
      count++;
      return;
    }
    if (n.type === 'binary_expression') {
      // tree-sitter-cpp exposes the operator via a child node typed
      // `binary_expression`'s text. Look for `&&` / `||` directly.
      if (/(\s|^)(\|\||&&)(\s|$)/.test(n.text)) count++;
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
    case 'identifier':
    case 'field_identifier':
    case 'type_identifier':
      return node.text;
    case 'qualified_identifier': {
      // `Foo::bar` — take the last segment.
      const named = node.namedChildren;
      const last = named[named.length - 1];
      return last ? bareName(last) : null;
    }
    case 'field_expression': {
      const f = node.childForFieldName ? node.childForFieldName('field') : null;
      if (f) return bareName(f);
      const named = node.namedChildren;
      return named.length > 0 ? bareName(named[named.length - 1]) : null;
    }
    case 'template_function': {
      const f = node.childForFieldName ? node.childForFieldName('name') : null;
      if (f) return bareName(f);
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
      child.type === 'function_definition' ||
      child.type === 'class_specifier' ||
      child.type === 'struct_specifier' ||
      child.type === 'lambda_expression'
    ) {
      continue;
    }
    walkSkipNested(child, visit);
  }
}
