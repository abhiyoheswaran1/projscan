import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

/**
 * Extract `require` / `require_relative` / `load` / `autoload` calls from a
 * Ruby AST.
 *
 * Ruby has no `import` keyword - these are method calls. Tree-sitter-ruby
 * represents them as `call` nodes whose method identifier is `require` /
 * `require_relative` / etc., with a string argument carrying the path.
 *
 * Captured shapes:
 *   require 'json'
 *   require_relative 'helpers/util'
 *   load 'config.rb'
 *   autoload :Sym, 'lib/sym'
 *
 * Only top-level (module-level) calls are collected. Inner-scope requires
 * are valid Ruby but rare and noisy for graph purposes.
 */
const REQUIRE_NAMES = new Set(['require', 'require_relative', 'load', 'autoload']);

export function extractRubyImports(root: TsNode): AstImport[] {
  const out: AstImport[] = [];
  visit(root, out);
  return out;
}

function visit(node: TsNode, out: AstImport[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'call') {
      handleCall(child, out);
    } else if (child.type === 'body_statement' || child.type === 'program') {
      visit(child, out);
    }
    // Don't descend into method/class/module bodies - only top-level requires.
  }
}

function handleCall(node: TsNode, out: AstImport[]): void {
  // The `method` field holds the identifier we're calling.
  const methodNode = node.childForFieldName?.('method') ?? findChild(node, 'identifier');
  if (!methodNode) return;
  if (!REQUIRE_NAMES.has(methodNode.text)) return;

  const args = node.childForFieldName?.('arguments') ?? findChild(node, 'argument_list');
  if (!args) return;

  const line = node.startPosition.row + 1;
  // For autoload(:Symbol, 'path'), the path is the SECOND argument.
  // For require/require_relative/load, the path is the FIRST and only.
  const isAutoload = methodNode.text === 'autoload';
  const targetIndex = isAutoload ? 1 : 0;

  let i = 0;
  for (const arg of args.namedChildren) {
    if (arg.type === 'string' && i === targetIndex) {
      const inner = findChild(arg, 'string_content');
      if (inner) {
        out.push({
          source: inner.text,
          kind: methodNode.text === 'require_relative' ? 'static' : 'static',
          specifiers: [],
          typeOnly: false,
          line,
        });
      }
      return;
    }
    i++;
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) {
    if (c.type === type) return c;
  }
  return null;
}
