import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract top-level C++ declarations as exports.
 *
 * C++ has no first-class export model the way Rust / Kotlin do; "exports"
 * for graph purposes are top-level declarations that are visible to other
 * translation units. We surface:
 *
 *   function_definition       → function     (free functions and methods)
 *   class_specifier           → class
 *   struct_specifier          → class        (structs are classes with default-public)
 *   union_specifier           → class
 *   enum_specifier            → enum
 *   alias_declaration         → type         (`using Foo = Bar;`)
 *   type_definition           → type         (`typedef ... Foo;`)
 *   declaration (var/const)   → variable     (top-level globals)
 *
 * `static` at file scope marks a translation-unit-internal symbol; we
 * still surface it (the graph treats it as a local definition).
 *
 * Member declarations inside class bodies are NOT extracted (they're
 * reachable via the class export). Anonymous namespaces are descended.
 */
const EXPORT_NODE_TO_KIND: Record<string, SymbolKind> = {
  function_definition: 'function',
  class_specifier: 'class',
  struct_specifier: 'class',
  union_specifier: 'class',
  enum_specifier: 'enum',
  alias_declaration: 'type',
  type_definition: 'type',
};

export function extractCppExports(root: TsNode): AstExport[] {
  const exports: AstExport[] = [];
  visitTopLevel(root, exports);
  return exports;
}

function visitTopLevel(node: TsNode, out: AstExport[]): void {
  // Descend through namespace and linkage_specification (`extern "C" { ... }`)
  // wrappers — top-level declarations inside them are still file-scope.
  if (
    node.type === 'translation_unit' ||
    node.type === 'namespace_definition' ||
    node.type === 'linkage_specification' ||
    node.type === 'declaration_list'
  ) {
    for (const c of node.namedChildren) visitTopLevel(c, out);
    return;
  }

  const kind = EXPORT_NODE_TO_KIND[node.type];
  if (kind) {
    const name = nameOf(node);
    if (name) out.push({ name, kind, typeOnly: false, line: node.startPosition.row + 1 });
    return;
  }

  // Top-level variable / constant declarations: tree-sitter-cpp uses
  // `declaration` for these. A declaration at translation-unit scope with
  // a single declarator is a variable export.
  if (node.type === 'declaration') {
    const declarators = collectDeclarators(node);
    for (const d of declarators) {
      out.push({ name: d.name, kind: 'variable', typeOnly: false, line: node.startPosition.row + 1 });
    }
    return;
  }

  // Don't recurse into anything else — class bodies and function bodies
  // hold non-top-level declarations.
}

interface DeclaredName {
  name: string;
}

function collectDeclarators(declaration: TsNode): DeclaredName[] {
  const out: DeclaredName[] = [];
  for (const c of declaration.namedChildren) {
    // function_declarator / init_declarator / array_declarator are wrappers
    // around an identifier. Drill through them.
    const id = innerIdentifier(c);
    if (id) out.push({ name: id });
  }
  return out;
}

function innerIdentifier(node: TsNode): string | null {
  if (
    node.type === 'identifier' ||
    node.type === 'field_identifier' ||
    node.type === 'type_identifier'
  ) {
    return node.text;
  }
  if (
    node.type === 'init_declarator' ||
    node.type === 'array_declarator' ||
    node.type === 'pointer_declarator' ||
    node.type === 'reference_declarator' ||
    node.type === 'parenthesized_declarator' ||
    node.type === 'function_declarator'
  ) {
    if (node.childForFieldName) {
      const dec = node.childForFieldName('declarator');
      if (dec) return innerIdentifier(dec);
    }
    for (const c of node.namedChildren) {
      const r = innerIdentifier(c);
      if (r) return r;
    }
  }
  return null;
}

function nameOf(node: TsNode): string | null {
  if (node.childForFieldName) {
    const id = node.childForFieldName('name');
    if (id && id.text) return id.text;
    const dec = node.childForFieldName('declarator');
    if (dec) return innerIdentifier(dec);
  }
  for (const c of node.namedChildren) {
    if (c.type === 'identifier' || c.type === 'field_identifier' || c.type === 'type_identifier') {
      return c.text;
    }
  }
  return innerIdentifier(node);
}
