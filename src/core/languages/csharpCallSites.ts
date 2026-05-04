interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract called-function names from C#. We surface a deduplicated list of
 * bare identifiers (mirrors JS / Python / Go / Java / Ruby / Rust / PHP).
 *
 *   invocation_expression : function child is one of:
 *     identifier                foo(args)              → "foo"
 *     member_access_expression  obj.Method(args)       → "Method"
 *     generic_name              Foo<T>(args)           → "Foo"
 *     conditional_access_expression  obj?.Method(args) → "Method"
 *
 * Object-creation calls (`new Foo()`) are NOT surfaced — they're tracked as
 * type instantiations elsewhere if needed; consistent with the other adapters
 * which don't emit constructors as call sites.
 */
export function extractCsharpCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, (n) => {
    if (n.type !== 'invocation_expression') return;
    const fn = n.childForFieldName ? n.childForFieldName('function') : firstNamedChild(n);
    if (!fn) return;
    const name = nameOf(fn);
    if (name) seen.add(name);
  });
  return [...seen];
}

function nameOf(node: TsNode): string | null {
  switch (node.type) {
    case 'identifier':
      return node.text;
    case 'member_access_expression':
    case 'conditional_access_expression':
    case 'member_binding_expression': {
      const name = node.childForFieldName ? node.childForFieldName('name') : null;
      if (name) return nameOf(name);
      // Fallback: last identifier-bearing child.
      const named = node.namedChildren;
      if (named.length === 0) return null;
      return nameOf(named[named.length - 1]);
    }
    case 'generic_name': {
      for (const c of node.namedChildren) {
        if (c.type === 'identifier') return c.text;
      }
      return null;
    }
    case 'qualified_name': {
      // Take the last segment.
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

function firstNamedChild(n: TsNode): TsNode | null {
  return n.namedChildren[0] ?? null;
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
