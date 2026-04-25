interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-java AST.
 *
 * Decision points:
 *   if_statement, ternary_expression          +1
 *   for_statement, enhanced_for_statement     +1
 *   while_statement, do_statement             +1
 *   switch_label (case ...; default does NOT count)
 *   catch_clause                              +1
 *   binary_expression with `&&` or `||`       +1 each
 *
 * `else` does not count (it shares the if's decision). `try` and `finally`
 * do not count.
 */
export function extractJavaCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_statement':
    case 'ternary_expression':
    case 'for_statement':
    case 'enhanced_for_statement':
    case 'while_statement':
    case 'do_statement':
    case 'catch_clause':
      return true;
    case 'switch_label': {
      // The grammar uses `switch_label` for both `case X:` and `default:`.
      // Default does not contribute a new branch (it's the fallthrough).
      return !/^\s*default\b/.test(n.text);
    }
    case 'binary_expression':
      return /(\s|^)(\|\||&&)(\s|$)/.test(n.text);
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
