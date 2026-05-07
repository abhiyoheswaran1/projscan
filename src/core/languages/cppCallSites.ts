interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract called-name from each `call_expression` in a tree-sitter-cpp AST.
 * Mirrors the existing adapter behaviour: dedupe names, strip qualification,
 * so `obj.foo()`, `Foo::bar()`, and `bar()` all surface as just the leaf.
 */
export function extractCppCallSites(root: TsNode): string[] {
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
    case 'identifier':
    case 'field_identifier':
    case 'type_identifier':
      return node.text;
    case 'qualified_identifier': {
      const last = node.namedChildren[node.namedChildren.length - 1];
      return last ? bareName(last) : null;
    }
    case 'field_expression': {
      const f = node.childForFieldName ? node.childForFieldName('field') : null;
      if (f) return bareName(f);
      const last = node.namedChildren[node.namedChildren.length - 1];
      return last ? bareName(last) : null;
    }
    case 'template_function': {
      const f = node.childForFieldName ? node.childForFieldName('name') : null;
      return f ? bareName(f) : null;
    }
    case 'call_expression': {
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
