import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * C# top-level type declarations are visible to anything that imports their
 * namespace iff they are `public`. Everything else (`internal`, `private`,
 * `file`, no modifier — defaults to `internal` at namespace scope) stays
 * inside the assembly and is *not* an export from this file.
 *
 * Type kinds we surface:
 *   class_declaration / record_declaration / struct_declaration → 'class'
 *   interface_declaration                                       → 'interface'
 *   enum_declaration                                            → 'enum'
 *   delegate_declaration                                        → 'function'
 *   method_declaration (top-level statements / static class)    → 'function'
 *
 * We descend into namespace_declaration / file_scoped_namespace_declaration
 * so namespace-wrapped types still count as top-level for export purposes.
 */
const TOP_LEVEL_KINDS: Record<string, SymbolKind> = {
  class_declaration: 'class',
  record_declaration: 'class',
  struct_declaration: 'class',
  interface_declaration: 'interface',
  enum_declaration: 'enum',
  delegate_declaration: 'function',
  method_declaration: 'function',
};

export function extractCsharpExports(root: TsNode): AstExport[] {
  const exports: AstExport[] = [];
  for (const child of root.namedChildren) visit(child, exports);
  return exports;
}

function visit(node: TsNode, out: AstExport[]): void {
  if (node.type === 'namespace_declaration' || node.type === 'file_scoped_namespace_declaration') {
    const body = node.namedChildren.find((c) => c.type === 'declaration_list');
    const target = body ?? node;
    for (const c of target.namedChildren) visit(c, out);
    return;
  }
  const kind = TOP_LEVEL_KINDS[node.type];
  if (!kind) return;
  if (!isPublic(node)) return;
  const name = nameOf(node);
  if (!name) return;
  out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
}

function isPublic(node: TsNode): boolean {
  for (const c of node.namedChildren) {
    if (c.type === 'modifier' && c.text === 'public') return true;
  }
  return false;
}

function nameOf(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id) return id.text;
  }
  for (const c of node.namedChildren) {
    if (c.type === 'identifier') return c.text;
  }
  return null;
}
