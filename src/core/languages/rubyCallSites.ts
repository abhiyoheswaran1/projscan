/**
 * Extract call-site identifiers from a tree-sitter-ruby AST.
 *
 * Ruby's `call` node covers BOTH bare method calls (`foo(...)`) and
 * receiver-method calls (`obj.method(...)`). The method identifier is on the
 * `method` field. We exclude `require` family calls so they don't pollute the
 * "who calls foo" lookup with import noise.
 */

interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

const REQUIRE_NAMES = new Set(['require', 'require_relative', 'load', 'autoload']);

export function extractRubyCallSites(root: TsNode): string[] {
  const seen = new Set<string>();
  walk(root, seen);
  return [...seen];
}

function walk(node: TsNode, out: Set<string>): void {
  if (node.type === 'call') {
    const methodNode = node.childForFieldName?.('method') ?? findChild(node, 'identifier');
    if (
      methodNode &&
      (methodNode.type === 'identifier' || methodNode.type === 'constant') &&
      !REQUIRE_NAMES.has(methodNode.text)
    ) {
      out.add(methodNode.text);
    }
  }
  for (const child of node.namedChildren) walk(child, out);
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) {
    if (c.type === type) return c;
  }
  return null;
}
