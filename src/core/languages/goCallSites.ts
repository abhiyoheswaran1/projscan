/**
 * Extract call-site identifiers from a tree-sitter-go AST.
 *
 * Tree-sitter-go uses `call_expression` with a `function` field. Common shapes:
 *   foo(...)            - function: identifier "foo"           → record "foo"
 *   pkg.Foo(...)        - function: selector_expression .Foo   → record "Foo"
 *   obj.method(...)     - function: selector_expression .method → record "method"
 *
 * For more complex callees (type assertions, parenthesized, function literals)
 * we skip - a name is needed to be useful for "who calls X" lookups. Mirrors
 * the JS/TS and Python adapters.
 */

interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

export function extractGoCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, seen);
  return [...seen];
}

function walk(node: TsNode, out: Set<string>): void {
  if (node.type === 'call_expression') {
    const fn = node.childForFieldName?.('function') ?? null;
    const name = nameFromCallee(fn);
    if (name) out.add(name);
  }
  for (const child of node.namedChildren) walk(child, out);
}

function nameFromCallee(node: TsNode | null): string | null {
  if (!node) return null;
  if (node.type === 'identifier') return node.text;
  if (node.type === 'selector_expression') {
    // pkg.Foo or obj.method - the "field" child holds the rightmost identifier.
    const field = node.childForFieldName?.('field') ?? null;
    if (field && (field.type === 'field_identifier' || field.type === 'identifier')) {
      return field.text;
    }
  }
  return null;
}
