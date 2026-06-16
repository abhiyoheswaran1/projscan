import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract C# `using` directives from a tree-sitter-c-sharp AST.
 *
 * Handled forms:
 *   using System;                              → "System"
 *   using System.Collections.Generic;          → "System.Collections.Generic"
 *   using static System.Console;               → "System.Console"
 *   using Alias = System.Collections.Generic;  → "System.Collections.Generic", alias "Alias"
 *
 * We surface the full dotted namespace (no `using static` distinction at the
 * AstImport level — same as Java's `import static foo.Bar.method;`).
 *
 * NOT handled:
 *   - Global usings (file-scoped namespaces) — same shape, surfaces normally.
 *   - Aliased open generic types (`using L = List<int>`) — alias is preserved
 *     but the path is the unqualified type form (still useful for fan-out).
 */
export function extractCsharpImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  for (const child of root.namedChildren) {
    if (child.type === 'using_directive') collectUsing(child, imports);
    else if (
      child.type === 'file_scoped_namespace_declaration' ||
      child.type === 'namespace_declaration'
    ) {
      // Inside a namespace, more usings can appear.
      for (const inner of child.namedChildren) {
        if (inner.type === 'using_directive') collectUsing(inner, imports);
      }
    }
  }
  return imports;
}

function collectUsing(node: TsNode, out: AstImport[]): void {
  const line = node.startPosition.row + 1;
  // Aliased: first identifier is the alias, second is the path.
  // Plain:   first child is the path (identifier or qualified_name).
  // Static:  the keyword `static` is anonymous; the path is the only named child.
  const named = node.namedChildren;
  if (named.length === 0) return;

  let alias: string | undefined;
  let pathNode: TsNode;
  if (
    named.length >= 2 &&
    named[0].type === 'identifier' &&
    (named[1].type === 'qualified_name' ||
      named[1].type === 'identifier' ||
      named[1].type === 'generic_name')
  ) {
    alias = named[0].text;
    pathNode = named[1];
  } else {
    // Last named child is the path (skip any keyword-like tokens that the
    // grammar may surface as a name).
    pathNode = named[named.length - 1];
  }
  const source = readPath(pathNode);
  if (!source) return;
  out.push({
    source,
    kind: 'static',
    specifiers: alias ? [alias] : [],
    typeOnly: false,
    line,
  });
}

function readPath(node: TsNode): string {
  if (node.type === 'identifier') return node.text;
  if (node.type === 'qualified_name') {
    const parts: string[] = [];
    collect(node, parts);
    return parts.join('.');
  }
  if (node.type === 'generic_name') {
    // For `using X = List<int>` style — drop the type arguments.
    for (const c of node.namedChildren) {
      if (c.type === 'identifier') return c.text;
    }
  }
  return node.text;
}

function collect(node: TsNode, out: string[]): void {
  if (node.type === 'identifier') {
    out.push(node.text);
    return;
  }
  for (const c of node.namedChildren) collect(c, out);
}
