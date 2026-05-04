interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract called-function names from PHP. Three call shapes, all surfaced
 * as a deduplicated list of bare identifiers (mirrors the JS / Python /
 * Go / Java / Ruby / Rust adapters):
 *
 *   function_call_expression   foo(args)               → "foo"
 *   member_call_expression     $obj->method(args)      → "method"
 *   scoped_call_expression     Foo::method(args)       → "method"
 *   nullsafe_member_call_expression  $obj?->method()   → "method"
 *
 * `require` / `include` family are NOT call expressions in tree-sitter-php
 * (they're their own expression kinds); we already handle those as imports.
 */
export function extractPhpCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, (n) => {
    let name: string | null = null;
    if (n.type === 'function_call_expression') {
      name = nameOf(n.childForFieldName ? n.childForFieldName('function') : null);
    } else if (
      n.type === 'member_call_expression' ||
      n.type === 'nullsafe_member_call_expression' ||
      n.type === 'scoped_call_expression'
    ) {
      name = nameOf(n.childForFieldName ? n.childForFieldName('name') : null);
    }
    if (name) seen.add(name);
  });
  return [...seen];
}

function nameOf(node: TsNode | null): string | null {
  if (!node) return null;
  switch (node.type) {
    case 'name':
    case 'variable_name':
      return node.text.replace(/^\$/, '');
    case 'qualified_name': {
      // Take the last segment.
      let last: TsNode | null = null;
      for (const c of node.namedChildren) {
        if (c.type === 'name') last = c;
      }
      return last ? last.text : null;
    }
    default:
      return null;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
