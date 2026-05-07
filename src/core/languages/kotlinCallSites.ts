interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract the called identifier from each `call_expression` in a
 * tree-sitter-kotlin AST. Mirrors the existing adapter behaviour: we
 * deduplicate names and strip qualification so that `foo.bar()` and `bar()`
 * both produce `bar`. Constructor calls (`Foo()`) and infix-form calls are
 * captured the same way.
 */
export function extractKotlinCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, (n) => {
    if (n.type !== 'call_expression') return;
    const fn = pickCallee(n);
    if (!fn) return;
    const name = bareName(fn);
    if (name) seen.add(name);
  });
  return [...seen];
}

function pickCallee(node: TsNode): TsNode | null {
  if (node.childForFieldName) {
    const f = node.childForFieldName('function');
    if (f) return f;
  }
  return node.namedChildren[0] ?? null;
}

function bareName(node: TsNode): string | null {
  switch (node.type) {
    case 'simple_identifier':
    case 'identifier':
    case 'type_identifier':
      return node.text;
    case 'navigation_expression': {
      const last = node.namedChildren[node.namedChildren.length - 1];
      return last ? bareName(last) : null;
    }
    case 'navigation_suffix': {
      for (const c of node.namedChildren) {
        const n = bareName(c);
        if (n) return n;
      }
      return null;
    }
    case 'call_expression': {
      // Foo()() — a chained invocation; recurse on the inner callee.
      const inner = pickCallee(node);
      return inner ? bareName(inner) : null;
    }
    default:
      return null;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
