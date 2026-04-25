/**
 * Extract call-site identifiers from a tree-sitter-java AST.
 *
 * tree-sitter-java's call shape: `method_invocation` with field `name` for the
 * called method and optional `object` (for `obj.method(...)`) or no object
 * (for `method(...)` inside the same class). Constructor calls
 * (`object_creation_expression`) are also recorded by the type name.
 */

interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

export function extractJavaCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, seen);
  return [...seen];
}

function walk(node: TsNode, out: Set<string>): void {
  if (node.type === 'method_invocation') {
    const name = node.childForFieldName?.('name') ?? null;
    if (name && (name.type === 'identifier' || name.type === 'field_identifier')) {
      out.add(name.text);
    }
  } else if (node.type === 'object_creation_expression') {
    // `new Foo(...)` - record `Foo` so "who instantiates Foo?" works.
    const type = node.childForFieldName?.('type') ?? null;
    if (type) {
      const last = lastIdentifier(type);
      if (last) out.add(last);
    }
  }
  for (const child of node.namedChildren) walk(child, out);
}

/** Pull the rightmost simple name from a type node (handles type_identifier and scoped_type_identifier). */
function lastIdentifier(node: TsNode): string | null {
  if (node.type === 'type_identifier' || node.type === 'identifier') return node.text;
  // scoped_type_identifier carries a chain; walk to the last name.
  let last: string | null = null;
  for (const c of node.namedChildren) {
    if (c.type === 'type_identifier' || c.type === 'identifier') last = c.text;
  }
  return last;
}
