import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
}

/**
 * Extract import declarations from a tree-sitter-java AST.
 *
 * Java imports come in three shapes:
 *   import java.util.List;
 *   import java.util.*;          // wildcard
 *   import static foo.Bar.X;     // static
 *
 * The grammar emits `import_declaration` at the top level. The dotted path is
 * captured as `scoped_identifier`; a wildcard appears as an `asterisk` child.
 * We record the package portion (everything before the last segment for type
 * imports, the whole path for wildcards/static imports) as the import source  - 
 * matching how a resolver will look up the target.
 */
export function extractJavaImports(root: TsNode): AstImport[] {
  const out: AstImport[] = [];
  for (const child of root.namedChildren) {
    if (child.type === 'import_declaration') {
      handleImport(child, out);
    }
  }
  return out;
}

function handleImport(node: TsNode, out: AstImport[]): void {
  const line = node.startPosition.row + 1;
  // Collect the dotted path text. With wildcards the asterisk node sits next
  // to the scoped_identifier; we keep `.*` on the source so the resolver can
  // distinguish.
  let path: string | null = null;
  let wildcard = false;
  for (const c of node.namedChildren) {
    if (c.type === 'scoped_identifier' || c.type === 'identifier') {
      path = c.text;
    } else if (c.type === 'asterisk') {
      wildcard = true;
    }
  }
  if (!path) return;
  out.push({
    source: wildcard ? `${path}.*` : path,
    kind: 'static',
    specifiers: [],
    typeOnly: false,
    line,
  });
}
