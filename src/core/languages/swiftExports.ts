import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract Swift top-level declarations as exports. Swift's default
 * visibility is `internal` (visible within the module). For graph
 * purposes we treat everything that is NOT explicitly `private` or
 * `fileprivate` as exported — module-internal symbols still participate
 * in cross-file resolution within the module.
 *
 * Kinds:
 *   func foo()                     → function
 *   class Foo / struct Foo         → class
 *   protocol Foo                   → interface
 *   enum Color                     → enum
 *   typealias Bar = ...            → type
 *   let / var x                    → variable
 *   actor Foo                      → class
 */
const EXPORT_NODE_TO_KIND: Record<string, SymbolKind> = {
  function_declaration: 'function',
  class_declaration: 'class',
  protocol_declaration: 'interface',
  typealias_declaration: 'type',
  property_declaration: 'variable',
};

export function extractSwiftExports(root: TsNode): AstExport[] {
  const exports: AstExport[] = [];
  for (const child of root.namedChildren) {
    visitTopLevel(child, exports);
  }
  return exports;
}

function visitTopLevel(node: TsNode, out: AstExport[]): void {
  if (node.type === 'class_declaration') {
    if (isHidden(node)) return;
    const name = nameOf(node);
    if (!name) return;
    const head = headerText(node);
    let kind: SymbolKind = 'class';
    if (/\benum\b/.test(head)) kind = 'enum';
    out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
    return;
  }
  const kind = EXPORT_NODE_TO_KIND[node.type];
  if (!kind) {
    for (const c of node.namedChildren) visitTopLevel(c, out);
    return;
  }
  if (isHidden(node)) return;
  const name = nameOf(node);
  if (!name) return;
  out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
}

function headerText(node: TsNode): string {
  const idx = node.text.indexOf('{');
  return idx >= 0 ? node.text.slice(0, idx) : node.text;
}

function isHidden(node: TsNode): boolean {
  for (const c of node.namedChildren) {
    if (c.type === 'modifiers' || c.type === 'modifier_list') {
      for (const m of c.namedChildren) {
        const t = m.text.trim();
        if (t === 'private' || t === 'fileprivate') return true;
      }
    }
    if (c.type === 'visibility_modifier') {
      const t = c.text.trim();
      if (t === 'private' || t === 'fileprivate') return true;
    }
  }
  return false;
}

function nameOf(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id && id.text) return id.text;
  }
  for (const c of node.namedChildren) {
    if (c.type === 'simple_identifier' || c.type === 'identifier' || c.type === 'type_identifier') {
      return c.text;
    }
  }
  const m = /\b(let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(node.text);
  if (m) return m[2];
  return null;
}
