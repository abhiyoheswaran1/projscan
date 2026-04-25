import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

/**
 * Extract package-level "exports" from a Go AST.
 *
 * Go's export rule is mechanical: an identifier is exported iff it starts
 * with an uppercase letter. We scan top-level declarations only — local
 * symbols inside functions are not part of the package surface.
 *
 * Captured forms:
 *   func Foo() {}                      → function
 *   func (r *T) Foo() {}               → function (method)
 *   type Foo struct {} | interface {}  → type / interface
 *   var Foo = ... / var Foo Type       → variable
 *   const Foo = ...                    → variable
 */
export function extractGoExports(root: TsNode): AstExport[] {
  const out: AstExport[] = [];
  for (const child of root.namedChildren) {
    visitTopLevel(child, out);
  }
  return out;
}

function visitTopLevel(node: TsNode, out: AstExport[]): void {
  switch (node.type) {
    case 'function_declaration':
      addIfExported(name(node), 'function', node, out);
      return;
    case 'method_declaration':
      addIfExported(name(node), 'function', node, out);
      return;
    case 'type_declaration':
      for (const spec of node.namedChildren) {
        if (spec.type === 'type_spec' || spec.type === 'type_alias') {
          const id = spec.childForFieldName?.('name') ?? firstIdent(spec);
          const kind = detectTypeKind(spec);
          addIfExported(id?.text, kind, spec, out);
        }
      }
      return;
    case 'var_declaration':
    case 'const_declaration':
      for (const spec of node.namedChildren) {
        if (spec.type === 'var_spec' || spec.type === 'const_spec') {
          // A spec can declare multiple names: `var X, Y int`.
          for (const c of spec.namedChildren) {
            if (c.type === 'identifier') addIfExported(c.text, 'variable', spec, out);
          }
        }
      }
      return;
    default:
      return;
  }
}

function name(node: TsNode): string | undefined {
  return node.childForFieldName?.('name')?.text ?? firstIdent(node)?.text;
}

function firstIdent(node: TsNode): TsNode | undefined {
  for (const c of node.namedChildren) {
    if (c.type === 'identifier' || c.type === 'field_identifier' || c.type === 'type_identifier') return c;
  }
  return undefined;
}

function detectTypeKind(spec: TsNode): SymbolKind {
  // type_spec children: identifier + (struct_type | interface_type | ...).
  for (const c of spec.namedChildren) {
    if (c.type === 'interface_type') return 'interface';
    if (c.type === 'struct_type') return 'class';
  }
  return 'type';
}

function addIfExported(
  name: string | undefined,
  kind: SymbolKind,
  node: TsNode,
  out: AstExport[],
): void {
  if (!name) return;
  // Go's export rule: leading character is an uppercase Unicode letter.
  const first = name.charAt(0);
  if (first !== first.toUpperCase() || first === first.toLowerCase()) return;
  out.push({
    name,
    kind,
    typeOnly: false,
    line: node.startPosition.row + 1,
  });
}
