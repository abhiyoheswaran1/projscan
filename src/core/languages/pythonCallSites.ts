/**
 * Extract call-site identifiers from a tree-sitter-python AST.
 *
 * For `foo(...)` we record `foo`. For `obj.method(...)` (attribute call) we
 * record `method` (the rightmost name). For more complex callees (subscripts,
 * lambdas-immediately-invoked, decorators acting as callees, etc.) we skip  - 
 * a name is needed to be useful for "who calls X" lookups.
 *
 * Mirrors the JS/TS behaviour in `src/core/ast.ts`: identifiers and the final
 * member-property name; uniqued before return.
 */

interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

export function extractPythonCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, seen);
  return [...seen];
}

function walk(node: TsNode, out: Set<string>): void {
  if (node.type === 'call') {
    const fn = node.childForFieldName?.('function') ?? null;
    const name = nameFromCallee(fn);
    if (name) out.add(name);
  }
  for (const child of node.namedChildren) walk(child, out);
}

function nameFromCallee(node: TsNode | null): string | null {
  if (!node) return null;
  if (node.type === 'identifier') return node.text;
  if (node.type === 'attribute') {
    // `obj.method` - the rightmost identifier is the called name.
    const last = node.childForFieldName?.('attribute') ?? null;
    if (last && last.type === 'identifier') return last.text;
  }
  return null;
}
