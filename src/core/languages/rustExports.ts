import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Top-level Rust items that may carry a `pub` visibility modifier and are
 * worth exposing as exports. Items are private by default; only `pub` items
 * are exports.
 */
const EXPORT_NODE_TO_KIND: Record<string, SymbolKind> = {
  function_item: 'function',
  function_signature_item: 'function',
  struct_item: 'class',
  union_item: 'class',
  enum_item: 'enum',
  trait_item: 'interface',
  type_item: 'type',
  const_item: 'variable',
  static_item: 'variable',
  mod_item: 'unknown',
};

/**
 * Extract public top-level items from a tree-sitter-rust AST. We descend
 * into `mod foo { ... }` blocks because `pub fn` declared inside an inline
 * module is still part of the crate's surface; the qualified name reported
 * is the bare item name (the module is captured separately as its own
 * export).
 *
 * Visibility detection: any direct child of type `visibility_modifier`
 * (which includes `pub`, `pub(crate)`, `pub(super)`, `pub(in path::to)`)
 * counts as exported. We do NOT distinguish between `pub` and `pub(crate)`
 * here — both are public to the crate's consumers in the graph sense.
 */
export function extractRustExports(root: TsNode): AstExport[] {
  const exports: AstExport[] = [];
  walk(root, (n) => {
    const kind = EXPORT_NODE_TO_KIND[n.type];
    if (!kind) return;
    if (!hasPublicVisibility(n)) return;
    const name = nameOf(n);
    if (!name) return;
    exports.push({
      name,
      kind,
      typeOnly: false,
      line: n.startPosition.row + 1,
    });
  });
  return exports;
}

function hasPublicVisibility(node: TsNode): boolean {
  for (const c of node.namedChildren) {
    if (c.type === 'visibility_modifier') return true;
  }
  return false;
}

function nameOf(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id) return id.text;
  }
  for (const c of node.namedChildren) {
    if (c.type === 'identifier' || c.type === 'type_identifier') return c.text;
  }
  return null;
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
