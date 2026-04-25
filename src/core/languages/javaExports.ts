import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

/**
 * Extract package-level "exports" from a Java AST.
 *
 * Java visibility rules:
 *   public        - visible everywhere
 *   protected     - visible to package + subclasses
 *   (none)        - package-private
 *   private       - file-only
 *
 * We treat `public` as the export surface (the typical "API") and skip
 * everything else. Top-level declarations only - nested types are part of
 * their enclosing class's surface, not separate exports.
 */
export function extractJavaExports(root: TsNode): AstExport[] {
  const out: AstExport[] = [];
  for (const child of root.namedChildren) {
    visitTopLevel(child, out);
  }
  return out;
}

function visitTopLevel(node: TsNode, out: AstExport[]): void {
  switch (node.type) {
    case 'class_declaration':
      addPublic(node, 'class', out);
      return;
    case 'interface_declaration':
      addPublic(node, 'interface', out);
      return;
    case 'enum_declaration':
      addPublic(node, 'enum', out);
      return;
    case 'record_declaration':
      // Java 14+ records - treat as a class for our purposes.
      addPublic(node, 'class', out);
      return;
    case 'annotation_type_declaration':
      addPublic(node, 'type', out);
      return;
    default:
      return;
  }
}

function addPublic(node: TsNode, kind: SymbolKind, out: AstExport[]): void {
  if (!hasModifier(node, 'public')) return;
  const nameNode = node.childForFieldName?.('name') ?? findChild(node, 'identifier');
  if (!nameNode) return;
  out.push({
    name: nameNode.text,
    kind,
    typeOnly: false,
    line: node.startPosition.row + 1,
  });
}

function hasModifier(node: TsNode, mod: string): boolean {
  const modsNode = findChild(node, 'modifiers');
  if (!modsNode) return false;
  // tree-sitter-java emits keyword modifiers (`public`, `private`, etc.) as
  // anonymous children - they're not in `namedChildren`. Walk the full child
  // list and match by token type or text.
  for (const c of modsNode.namedChildren) {
    if (c.type === mod || c.text === mod) return true;
  }
  // Anonymous-keyword fallback: scan tokens via text match. Modifiers contain
  // only the keyword tokens plus annotations; annotations start with `@` so
  // exact-match against `mod` is unambiguous.
  const tokens = modsNode.text.split(/\s+/);
  return tokens.includes(mod);
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) {
    if (c.type === type) return c;
  }
  return null;
}
