import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract PHP `use` statements from a tree-sitter-php AST.
 *
 * Handled forms:
 *   use Foo\Bar;                              → "Foo\\Bar"
 *   use Foo\Bar as Baz;                       → "Foo\\Bar", alias "Baz"
 *   use Foo\{Bar, Baz, Qux as Q};             → three imports
 *   use function Foo\some_fn;                 → "Foo\\some_fn", function-only
 *   use const Foo\SOME_CONST;                 → "Foo\\SOME_CONST", const-only
 *
 * Also handled in a lenient way:
 *   require / require_once / include / include_once 'path/to/file.php';
 *     → "path/to/file.php" (the resolver tries to land it on a repo file).
 *
 * NOT handled:
 *   - Dynamic require / include (`require $var`)
 *   - `extract()` / `class_exists()` reflective imports
 */
export function extractPhpImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  walk(root, (n) => {
    if (n.type === 'namespace_use_declaration') {
      collectUseDeclaration(n, imports);
    } else if (n.type === 'expression_statement') {
      // require / include statements are expression statements wrapping an
      // include_expression / require_expression node.
      for (const child of n.namedChildren) {
        if (
          child.type === 'include_expression' ||
          child.type === 'include_once_expression' ||
          child.type === 'require_expression' ||
          child.type === 'require_once_expression'
        ) {
          collectIncludeStatement(child, imports);
        }
      }
    }
  });
  return imports;
}

function collectUseDeclaration(node: TsNode, out: AstImport[]): void {
  // Some grammars expose `function` / `const` as a child token; we don't
  // distinguish those in the AstImport shape but we do parse the path.
  const line = node.startPosition.row + 1;

  // Find the qualifier (the `Foo\Bar` prefix) and any use-clauses or use-list.
  // The grammar can produce one of:
  //   namespace_use_declaration > namespace_use_clause > qualified_name
  //   namespace_use_declaration > namespace_name (prefix) + namespace_use_group
  // The group's prefix is a sibling of the group, not a child.
  let groupPrefix = '';
  for (const child of node.namedChildren) {
    if (child.type === 'namespace_name' || child.type === 'qualified_name') {
      groupPrefix = readPath(child);
    }
  }
  for (const child of node.namedChildren) {
    if (child.type === 'namespace_use_clause') {
      const { source, alias } = extractClause(child);
      if (source) out.push(makeImport(source, alias, line));
    } else if (child.type === 'namespace_use_group') {
      for (const groupChild of child.namedChildren) {
        if (
          groupChild.type === 'namespace_use_clause' ||
          groupChild.type === 'namespace_use_group_clause'
        ) {
          const { source, alias } = extractClause(groupChild);
          if (!source) continue;
          const full = groupPrefix ? `${groupPrefix}\\${source}` : source;
          out.push(makeImport(full, alias, line));
        }
      }
    }
  }
}

function extractClause(node: TsNode): { source: string; alias?: string } {
  let source = '';
  let alias: string | undefined;
  for (const c of node.namedChildren) {
    if (c.type === 'qualified_name' || c.type === 'namespace_name' || c.type === 'name') {
      if (!source) source = readPath(c);
    } else if (c.type === 'namespace_aliasing_clause' || c.type === 'name') {
      // alias clauses look like `as Baz` — the `name` after `as` is the alias.
      // This branch fires for `name` only when source is already set.
      const aliasName = node.childForFieldName ? node.childForFieldName('alias') : null;
      if (aliasName) alias = aliasName.text;
    }
  }
  // Field-based alias (the grammar's preferred shape).
  if (!alias && node.childForFieldName) {
    const a = node.childForFieldName('alias');
    if (a) alias = a.text;
  }
  return { source, alias };
}

function collectIncludeStatement(expr: TsNode, out: AstImport[]): void {
  // include_expression : `include 'path'` ; first non-include child is the
  // path expression. Grammar variants put it as a `string` literal child.
  const line = expr.startPosition.row + 1;
  for (const c of expr.namedChildren) {
    if (c.type === 'string' || c.type === 'encapsed_string') {
      const stringContent = c.namedChildren.find((s) => s.type === 'string_content');
      const raw = stringContent ? stringContent.text : c.text.replace(/^['"]|['"]$/g, '');
      if (raw) out.push({ source: raw, kind: 'static', specifiers: [], typeOnly: false, line });
      return;
    }
  }
}

function readPath(node: TsNode): string {
  // qualified_name has children: namespace_name (or names) + name.
  // Concatenate with backslashes.
  const parts: string[] = [];
  collectName(node, parts);
  return parts.join('\\');
}

function collectName(node: TsNode, out: string[]): void {
  if (node.type === 'name') {
    out.push(node.text);
    return;
  }
  for (const c of node.namedChildren) collectName(c, out);
}

function makeImport(source: string, alias: string | undefined, line: number): AstImport {
  return {
    source,
    kind: 'static',
    specifiers: alias ? [alias] : [],
    typeOnly: false,
    line,
  };
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
