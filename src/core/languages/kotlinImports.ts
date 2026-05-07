import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract Kotlin `import` statements from a tree-sitter-kotlin AST.
 *
 * Handled forms:
 *   import com.foo.Bar                    → source = "com.foo.Bar"
 *   import com.foo.*                      → source = "com.foo.*"
 *   import com.foo.Bar as Baz             → source = "com.foo.Bar", alias = "Baz"
 *
 * Kotlin doesn't have an explicit "re-export" notion at the import site
 * (re-exports are done via top-level `typealias` / `val` exposing imported
 * symbols). All imports are flagged as `static`.
 */
export function extractKotlinImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  walk(root, (n) => {
    if (n.type !== 'import_header') return;
    const source = readImportPath(n);
    if (!source) return;
    const alias = readAlias(n);
    imports.push({
      source,
      kind: 'static',
      specifiers: alias ? [alias] : [],
      typeOnly: false,
      line: n.startPosition.row + 1,
    });
  });
  return imports;
}

function readImportPath(node: TsNode): string {
  const segments: string[] = [];
  collectIdentifiers(node, segments, false);
  if (node.text.includes('.*')) segments.push('*');
  return segments.join('.');
}

function collectIdentifiers(node: TsNode, out: string[], insideAlias: boolean): void {
  if (insideAlias) return;
  if (node.type === 'import_alias') return;
  if (
    node.type === 'identifier' ||
    node.type === 'simple_identifier' ||
    node.type === 'type_identifier'
  ) {
    out.push(node.text);
    return;
  }
  for (const c of node.namedChildren) collectIdentifiers(c, out, insideAlias);
}

function readAlias(node: TsNode): string | null {
  for (const c of node.namedChildren) {
    if (c.type !== 'import_alias') continue;
    for (const sub of c.namedChildren) {
      if (sub.type === 'type_identifier' || sub.type === 'identifier' || sub.type === 'simple_identifier') {
        return sub.text;
      }
    }
    // Fallback: last token of `as <name>` text
    const m = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(c.text);
    if (m) return m[1];
  }
  return null;
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
