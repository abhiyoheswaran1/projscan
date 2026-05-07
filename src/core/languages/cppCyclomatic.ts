interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-cpp AST.
 *
 * Decision points in C++:
 *   if_statement                   +1
 *   for_statement                  +1
 *   for_range_loop                 +1
 *   while_statement                +1
 *   do_statement                   +1
 *   try_statement                  +1
 *   catch_clause                   +1 each
 *   case_statement (non-default)   +1
 *   conditional_expression (`?:`)  +1
 *   binary_expression `&&` / `||`  +1 each
 *
 * `case 1:` and `case 2:` count individually; `default:` does not.
 */
export function extractCppCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_statement':
    case 'for_statement':
    case 'for_range_loop':
    case 'while_statement':
    case 'do_statement':
    case 'try_statement':
    case 'catch_clause':
    case 'conditional_expression':
      return true;
    case 'case_statement': {
      // tree-sitter-cpp exposes a `value` field for `case X:` and leaves it
      // null for `default:`. Field-based detection is more reliable than
      // text inspection, which can misbehave when comments / whitespace
      // sit between the keyword and the colon.
      if (n.childForFieldName) {
        const value = n.childForFieldName('value');
        if (value) return true;
      }
      // Fallback for grammar versions without the `value` field: a regular
      // `case` has its label value as the first named child (literal /
      // identifier / expression). The `default` form's first named child
      // is whatever statement follows the colon.
      const first = n.namedChildren[0];
      if (!first) return false;
      return !STATEMENT_NODES.has(first.type);
    }
    case 'binary_expression':
      return /(\s|^)(\|\||&&)(\s|$)/.test(n.text);
    default:
      return false;
  }
}

const STATEMENT_NODES = new Set([
  'return_statement',
  'break_statement',
  'continue_statement',
  'expression_statement',
  'compound_statement',
  'if_statement',
  'for_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'goto_statement',
  'declaration',
  'labeled_statement',
]);

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
