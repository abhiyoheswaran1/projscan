import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Top-level PHP declarations are always public to anything that imports the
 * file's namespace via `use` — there's no `private` modifier at the file /
 * namespace scope (only inside classes). So all top-level
 * function_definition / class_declaration / interface_declaration /
 * trait_declaration / enum_declaration nodes count as exports.
 *
 * Method-level visibility is enforced inside `phpFunctions.ts` (where
 * we surface per-method CC); it doesn't matter at the file-export level.
 */
const TOP_LEVEL_EXPORTS: Record<string, SymbolKind> = {
  function_definition: 'function',
  class_declaration: 'class',
  interface_declaration: 'interface',
  trait_declaration: 'class',
  enum_declaration: 'enum',
};

export function extractPhpExports(root: TsNode): AstExport[] {
  const exports: AstExport[] = [];
  // Only walk top-level (program -> direct children). Nested classes are
  // method-level and addressed by phpFunctions, not file exports.
  for (const child of root.namedChildren) {
    visit(child, exports, /* depth */ 0);
  }
  return exports;
}

function visit(node: TsNode, out: AstExport[], depth: number): void {
  const kind = TOP_LEVEL_EXPORTS[node.type];
  if (kind && depth === 0) {
    const name = nameOf(node);
    if (name) {
      out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
    }
    return;
  }
  // namespace_definition wraps further declarations; descend with the same
  // depth so we still classify its top-level children as exports.
  if (node.type === 'namespace_definition') {
    const body = node.namedChildren.find(
      (c) => c.type === 'declaration_list' || c.type === 'compound_statement',
    );
    if (body) {
      for (const c of body.namedChildren) visit(c, out, depth);
    }
  }
}

function nameOf(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id) return id.text;
  }
  for (const c of node.namedChildren) {
    if (c.type === 'name') return c.text;
  }
  return null;
}
