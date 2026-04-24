import type { AstExport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
  firstNamedChild?: TsNode | null;
  childForFieldName?(name: string): TsNode | null;
}

/**
 * Extract "exports" from a tree-sitter-python AST.
 *
 * Python has no language-level export concept. projscan defines exports as
 * the top-level public API of a module:
 *   - top-level `def` / `async def` / `class`
 *   - top-level assignments whose LHS is a plain identifier
 *   - names brought in via `from .mod import foo` (re-exports)
 *
 * Filtered: single-underscore-prefixed names (`_private`), dunder names other
 * than ones that appear in `__all__`. If `__all__` is declared at the top
 * level as a list/tuple of string literals, it is authoritative: only names
 * in `__all__` are exports (regardless of underscore), and names not in
 * `__all__` are NOT exports.
 */
export function extractPythonExports(root: TsNode): AstExport[] {
  const allNames = readDunderAll(root);
  const found: AstExport[] = [];

  for (const child of root.namedChildren) {
    switch (child.type) {
      case 'function_definition': {
        const nameNode = nameOfFunctionOrClass(child);
        if (nameNode) {
          found.push({
            name: nameNode.text,
            kind: 'function',
            typeOnly: false,
            line: child.startPosition.row + 1,
          });
        }
        break;
      }
      case 'class_definition': {
        const nameNode = nameOfFunctionOrClass(child);
        if (nameNode) {
          found.push({
            name: nameNode.text,
            kind: 'class',
            typeOnly: false,
            line: child.startPosition.row + 1,
          });
        }
        break;
      }
      case 'decorated_definition': {
        // `@decorator\ndef foo(): ...` → the real def/class is a child.
        const inner = child.namedChildren.find(
          (c) => c.type === 'function_definition' || c.type === 'class_definition',
        );
        if (inner) {
          const nameNode = nameOfFunctionOrClass(inner);
          if (nameNode) {
            found.push({
              name: nameNode.text,
              kind: inner.type === 'class_definition' ? 'class' : 'function',
              typeOnly: false,
              line: child.startPosition.row + 1,
            });
          }
        }
        break;
      }
      case 'expression_statement': {
        collectAssignmentTargets(child, found);
        break;
      }
      case 'import_from_statement': {
        // Re-exports: `from .mod import foo` makes `foo` accessible as a
        // module-level name. Honor `__all__` gatekeeping below.
        collectFromImportRebindings(child, found);
        break;
      }
      default:
        break;
    }
  }

  if (allNames) {
    const set = new Set(allNames);
    return found.filter((e) => set.has(e.name));
  }
  return found.filter((e) => !e.name.startsWith('_'));
}

function nameOfFunctionOrClass(node: TsNode): TsNode | null {
  const named = node.childForFieldName?.('name');
  if (named) return named;
  // Fallback: first named identifier child.
  return node.namedChildren.find((c) => c.type === 'identifier') ?? null;
}

function collectAssignmentTargets(exprStmt: TsNode, out: AstExport[]): void {
  const assignment = exprStmt.namedChildren.find((c) => c.type === 'assignment');
  if (!assignment) return;
  const line = exprStmt.startPosition.row + 1;
  const lhs = assignment.namedChildren[0];
  if (!lhs) return;
  if (lhs.type === 'identifier') {
    out.push({ name: lhs.text, kind: 'variable', typeOnly: false, line });
  } else if (lhs.type === 'pattern_list' || lhs.type === 'tuple_pattern') {
    for (const part of lhs.namedChildren) {
      if (part.type === 'identifier') {
        out.push({ name: part.text, kind: 'variable', typeOnly: false, line });
      }
    }
  }
}

function collectFromImportRebindings(node: TsNode, out: AstExport[]): void {
  const line = node.startPosition.row + 1;
  const children = node.namedChildren;
  if (children.length < 2) return;
  for (let i = 1; i < children.length; i++) {
    const c = children[i];
    if (c.type === 'dotted_name') {
      out.push({ name: c.text.split('.').pop()!, kind: 'unknown', typeOnly: false, line });
    } else if (c.type === 'aliased_import') {
      const alias = c.namedChildren.find((g) => g.type === 'identifier');
      if (alias) out.push({ name: alias.text, kind: 'unknown', typeOnly: false, line });
    }
    // wildcard_import: `from x import *` does not produce known names.
  }
}

/**
 * Read `__all__ = [...]` or `__all__ = (...)` if declared at the top level.
 * Returns the list of string-literal entries, or null if __all__ is absent
 * or declared with a non-literal value (e.g. `__all__ = compute()`).
 */
function readDunderAll(root: TsNode): string[] | null {
  for (const child of root.namedChildren) {
    if (child.type !== 'expression_statement') continue;
    const assignment = child.namedChildren.find((c) => c.type === 'assignment');
    if (!assignment) continue;
    const lhs = assignment.namedChildren[0];
    if (!lhs || lhs.type !== 'identifier' || lhs.text !== '__all__') continue;
    const rhs = assignment.namedChildren[assignment.namedChildren.length - 1];
    if (!rhs) continue;
    if (rhs.type !== 'list' && rhs.type !== 'tuple') return null;
    const names: string[] = [];
    for (const item of rhs.namedChildren) {
      if (item.type === 'string') {
        const unwrapped = unwrapStringLiteral(item);
        if (unwrapped !== null) names.push(unwrapped);
      }
    }
    return names;
  }
  return null;
}

function unwrapStringLiteral(node: TsNode): string | null {
  // `"foo"` → "foo". tree-sitter-python represents this as a `string` node
  // whose content is `string_content` text; for our needs, trimming quotes is
  // good enough - supports 'foo', "foo", '''foo''', """foo""" consistently.
  const raw = node.text;
  const m = /^[uUbBrRfF]?(["'])(?:\1\1)?((?:\\.|(?!\1\1\1|\1).)*?)(?:\1\1)?\1$/s.exec(raw);
  if (m) return m[2];
  // Fallback: strip leading/trailing quote characters generically.
  const stripped = raw.replace(/^[uUbBrRfF]?['"]+/, '').replace(/['"]+$/, '');
  return stripped || null;
}
