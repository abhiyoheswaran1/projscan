import type { AstImport } from '../ast.js';

/** Minimal tree-sitter node surface we depend on. */
interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
  firstNamedChild?: TsNode | null;
  childForFieldName?(name: string): TsNode | null;
}

/**
 * Extract import edges from a tree-sitter-python AST.
 *
 * Traversal: walk top-level statements in the `module` node, and descend into
 * `try_statement` bodies so that conditional imports (e.g. `try: import x
 * except ImportError: import y as x`) are captured. Function/class-scoped
 * imports are intentionally ignored - they match JS/TS module-level semantics.
 */
export function extractPythonImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  visit(root, imports);
  return imports;
}

// Types we descend through to find conditional top-level imports. Does NOT
// include function/class bodies - imports scoped inside a function are local
// variables, not module-level dependencies (mirrors JS/TS semantics).
const DESCEND_TYPES = new Set([
  'try_statement',
  'if_statement',
  'elif_clause',
  'else_clause',
  'except_clause',
  'finally_clause',
  'with_statement',
  'with_clause',
  'block',
]);

function visit(node: TsNode, out: AstImport[]): void {
  for (const child of node.namedChildren) {
    switch (child.type) {
      case 'import_statement':
        handleImport(child, out);
        break;
      case 'import_from_statement':
        handleImportFrom(child, out);
        break;
      case 'future_import_statement':
        // Language pragma, not a real dependency.
        break;
      default:
        if (DESCEND_TYPES.has(child.type)) visit(child, out);
        break;
    }
  }
}

function handleImport(node: TsNode, out: AstImport[]): void {
  // `import a` | `import a.b.c` | `import a as b` | `import a, b`
  const line = node.startPosition.row + 1;
  for (const child of node.namedChildren) {
    if (child.type === 'dotted_name') {
      out.push({ source: child.text, kind: 'static', specifiers: [], typeOnly: false, line });
    } else if (child.type === 'aliased_import') {
      const inner = child.namedChildren.find((c) => c.type === 'dotted_name');
      if (inner) {
        out.push({ source: inner.text, kind: 'static', specifiers: [], typeOnly: false, line });
      }
    }
  }
}

function handleImportFrom(node: TsNode, out: AstImport[]): void {
  const line = node.startPosition.row + 1;
  const children = node.namedChildren;
  if (children.length === 0) return;

  // First child is either dotted_name (absolute) or relative_import.
  const head = children[0];
  let source: string;
  if (head.type === 'relative_import') {
    source = head.text.trim();
  } else if (head.type === 'dotted_name') {
    source = head.text;
  } else {
    return;
  }

  const specifiers: string[] = [];
  let sawWildcard = false;

  for (let i = 1; i < children.length; i++) {
    const c = children[i];
    if (c.type === 'wildcard_import') {
      sawWildcard = true;
      break;
    }
    if (c.type === 'dotted_name') {
      specifiers.push(c.text);
    } else if (c.type === 'aliased_import') {
      const original = c.namedChildren.find((g) => g.type === 'dotted_name');
      if (original) specifiers.push(original.text);
    }
  }

  out.push({
    source,
    kind: 'static',
    specifiers: sawWildcard ? ['*'] : specifiers,
    typeOnly: false,
    line,
  });
}
