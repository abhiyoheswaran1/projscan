import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract Rust `use` statements from a tree-sitter-rust AST.
 *
 * Handled forms:
 *   use foo::bar;                       → source = "foo::bar"
 *   use foo::bar::Baz;                  → source = "foo::bar::Baz"
 *   use foo::bar as baz;                → source = "foo::bar", specifier = "baz"
 *   use foo::{bar, baz};                → two imports, sources "foo::bar" and "foo::baz"
 *   use foo::{bar::Baz, qux::*};        → emits each leaf path
 *   use crate::foo::bar;                → source = "crate::foo::bar"
 *   use self::foo;                      → source = "self::foo"
 *   use super::foo;                     → source = "super::foo"
 *   pub use foo::bar;                   → re-export, kind = 'reexport'
 *
 * NOT handled (acceptable for graph-construction purposes):
 *   - Macro-imported items (`#[macro_use] extern crate ...`)
 *   - `extern crate` declarations (legacy Rust 2015 syntax)
 */
export function extractRustImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  walk(root, (n) => {
    if (n.type !== 'use_declaration') return;
    const isReexport = hasPublicVisibility(n);
    const argNode = pickUseArgument(n);
    if (!argNode) return;
    expandUsePath(argNode, [], (source, alias) => {
      imports.push({
        source,
        kind: isReexport ? 'reexport' : 'static',
        specifiers: alias ? [alias] : [],
        typeOnly: false,
        line: n.startPosition.row + 1,
      });
    });
  });
  return imports;
}

function hasPublicVisibility(node: TsNode): boolean {
  for (const c of node.namedChildren) {
    if (c.type === 'visibility_modifier') return true;
  }
  return false;
}

/**
 * `use_declaration` wraps a path expression. tree-sitter-rust may use
 * `argument` as the field name; if not we fall back to the first non-trivia
 * named child that looks like a path or `use_*` form.
 */
function pickUseArgument(use: TsNode): TsNode | null {
  if (use.childForFieldName) {
    const arg = use.childForFieldName('argument');
    if (arg) return arg;
  }
  for (const c of use.namedChildren) {
    if (c.type === 'visibility_modifier') continue;
    if (
      c.type === 'scoped_identifier' ||
      c.type === 'scoped_use_list' ||
      c.type === 'use_list' ||
      c.type === 'use_as_clause' ||
      c.type === 'use_wildcard' ||
      c.type === 'identifier' ||
      c.type === 'crate' ||
      c.type === 'self'
    ) {
      return c;
    }
  }
  return null;
}

/**
 * Walk a use-path subtree and emit one `(source, alias?)` pair per leaf.
 * `prefix` accumulates the `::`-separated segments already consumed on the
 * way down. Each leaf calls `emit(source, alias?)`.
 */
function expandUsePath(
  node: TsNode,
  prefix: string[],
  emit: (source: string, alias?: string) => void,
): void {
  switch (node.type) {
    case 'scoped_use_list': {
      // `foo::bar::{...}` — left side is the path prefix, right side is the brace list.
      let path = node.childForFieldName ? node.childForFieldName('path') : null;
      let list = node.childForFieldName ? node.childForFieldName('list') : null;
      if (!path && !list) {
        // Fields not available on this grammar version — walk children:
        // first non-list child is the prefix, the use_list child is the list.
        for (const c of node.namedChildren) {
          if (c.type === 'use_list' && !list) list = c;
          else if (!path) path = c;
        }
      }
      const newPrefix = [...prefix];
      if (path) collectPathSegments(path, newPrefix);
      if (list) {
        for (const child of list.namedChildren) {
          expandUsePath(child, newPrefix, emit);
        }
      }
      return;
    }
    case 'use_list': {
      // Bare `{a, b, c}` (uncommon at top level; usually wrapped in scoped_use_list).
      for (const child of node.namedChildren) {
        expandUsePath(child, prefix, emit);
      }
      return;
    }
    case 'use_as_clause': {
      // `foo::bar as baz`
      let pathNode = node.childForFieldName ? node.childForFieldName('path') : null;
      let aliasNode = node.childForFieldName ? node.childForFieldName('alias') : null;
      if (!pathNode || !aliasNode) {
        // First non-trivia child is the path; the second (or last) is the alias.
        const named = node.namedChildren;
        if (named.length >= 2) {
          if (!pathNode) pathNode = named[0];
          if (!aliasNode) aliasNode = named[named.length - 1];
        }
      }
      const segs = [...prefix];
      if (pathNode) collectPathSegments(pathNode, segs);
      emit(segs.join('::'), aliasNode?.text);
      return;
    }
    case 'use_wildcard': {
      // `foo::*`
      // The wildcard form has the path as a child (scoped_identifier or identifier).
      const segs = [...prefix];
      for (const c of node.namedChildren) collectPathSegments(c, segs);
      segs.push('*');
      emit(segs.join('::'));
      return;
    }
    case 'scoped_identifier':
    case 'identifier':
    case 'crate':
    case 'self':
    case 'super': {
      const segs = [...prefix];
      collectPathSegments(node, segs);
      emit(segs.join('::'));
      return;
    }
    default: {
      // Unknown wrapper - try to descend.
      for (const c of node.namedChildren) expandUsePath(c, prefix, emit);
    }
  }
}

/** Append the `::`-separated segments of a path expression to `out`. */
function collectPathSegments(node: TsNode, out: string[]): void {
  if (
    node.type === 'identifier' ||
    node.type === 'type_identifier' ||
    node.type === 'crate' ||
    node.type === 'self' ||
    node.type === 'super'
  ) {
    out.push(node.text);
    return;
  }
  if (node.type === 'scoped_identifier') {
    // tree-sitter-rust may or may not expose `path`/`name` as fields depending
    // on version. Try fields first; if neither is set, walk all named children.
    const path = node.childForFieldName ? node.childForFieldName('path') : null;
    const name = node.childForFieldName ? node.childForFieldName('name') : null;
    if (path || name) {
      if (path) collectPathSegments(path, out);
      if (name) collectPathSegments(name, out);
      return;
    }
    for (const c of node.namedChildren) collectPathSegments(c, out);
    return;
  }
  // Fallback: text-split (rare path types).
  const text = node.text.replace(/\s+/g, '');
  for (const seg of text.split('::')) if (seg) out.push(seg);
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
