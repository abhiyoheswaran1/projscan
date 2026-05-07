import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract Kotlin top-level declarations as exports. Kotlin's default
 * visibility is `public`; only declarations marked `private` or `internal`
 * are excluded. `protected` only applies to class members and is treated
 * as exported when on a top-level decl (which is unusual but valid in
 * tree-sitter's grammar).
 *
 * Kinds:
 *   fun foo()                  → function
 *   class Foo                  → class
 *   interface Foo              → interface
 *   object Foo                 → class    (Kotlin singleton object, modeled as class)
 *   enum class Color           → enum
 *   typealias Bar = ...        → type
 *   val/const x                → variable
 */
const EXPORT_NODE_TO_KIND: Record<string, SymbolKind> = {
  function_declaration: 'function',
  class_declaration: 'class',
  object_declaration: 'class',
  type_alias: 'type',
  property_declaration: 'variable',
};

export function extractKotlinExports(root: TsNode): AstExport[] {
  const exports: AstExport[] = [];
  // Top-level only: descend into the source_file/file_node body but not into
  // nested classes (their members aren't top-level exports for graph purposes).
  for (const child of root.namedChildren) {
    visitTopLevel(child, exports);
  }
  return exports;
}

function visitTopLevel(node: TsNode, out: AstExport[]): void {
  // Some grammars wrap top-level decls in `package_header` / `import_list` /
  // an explicit `top_level_object` node. We descend through wrappers.
  if (
    node.type === 'package_header' ||
    node.type === 'import_list' ||
    node.type === 'file_annotation'
  ) {
    return;
  }
  if (node.type === 'class_declaration') {
    const isInterface = /\binterface\b/.test(headerText(node));
    const isEnum = /\benum\s+class\b/.test(headerText(node));
    const kind: SymbolKind = isEnum ? 'enum' : isInterface ? 'interface' : 'class';
    if (!isPrivate(node)) {
      const name = nameOf(node);
      if (name) out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
    }
    return;
  }
  const kind = EXPORT_NODE_TO_KIND[node.type];
  if (!kind) {
    // Walk container nodes (e.g., source_file already iterated, but defensively descend).
    for (const c of node.namedChildren) visitTopLevel(c, out);
    return;
  }
  if (isPrivate(node)) return;
  const name = nameOf(node);
  if (!name) return;
  out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
}

function headerText(node: TsNode): string {
  // Just the first line — the `class`/`interface`/`enum class` keyword
  // appears in the header before the body opens.
  const idx = node.text.indexOf('{');
  return idx >= 0 ? node.text.slice(0, idx) : node.text;
}

function isPrivate(node: TsNode): boolean {
  for (const c of node.namedChildren) {
    if (c.type === 'modifiers' || c.type === 'modifier_list') {
      for (const m of c.namedChildren) {
        if (m.type === 'visibility_modifier') {
          const t = m.text.trim();
          if (t === 'private' || t === 'internal') return true;
        }
      }
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
  // property_declaration: `val/var <name> = ...`
  const m = /\b(val|var|const\s+val)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(node.text);
  if (m) return m[2];
  return null;
}
