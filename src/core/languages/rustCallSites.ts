interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract the called identifier from each `call_expression` in a
 * tree-sitter-rust AST. Mirrors the existing JS/TS, Python, Go, Java, Ruby
 * adapter behaviour: we deduplicate names and strip qualification so that
 * `foo::bar()` and `obj.bar()` both produce `bar`. Macro invocations
 * (`println!`, `vec!`) are NOT call expressions in Rust's grammar — they're
 * `macro_invocation` nodes; we currently don't include them as callSites
 * to avoid false positives across the macro-expansion boundary.
 */
export function extractRustCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, (n) => {
    if (n.type !== 'call_expression') return;
    const fn = n.childForFieldName ? n.childForFieldName('function') : null;
    if (!fn) return;
    const name = bareName(fn);
    if (name) seen.add(name);
  });
  return [...seen];
}

function bareName(node: TsNode): string | null {
  switch (node.type) {
    case 'identifier':
    case 'type_identifier':
    case 'field_identifier':
      return node.text;
    case 'scoped_identifier': {
      // `foo::bar::baz` - take the last segment.
      const name = node.childForFieldName ? node.childForFieldName('name') : null;
      if (name) return bareName(name);
      const last = node.namedChildren[node.namedChildren.length - 1];
      return last ? bareName(last) : null;
    }
    case 'field_expression': {
      // `obj.foo` - take the field name.
      const field = node.childForFieldName ? node.childForFieldName('field') : null;
      if (field) return bareName(field);
      return null;
    }
    case 'generic_function': {
      // `foo::<T>` - drill down to the underlying function path.
      const inner = node.namedChildren[0];
      return inner ? bareName(inner) : null;
    }
    default:
      // Closures, blocks, parenthesized expressions etc. - no useful name.
      return null;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
