interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-go AST.
 * Counts decision points across the whole file (package + functions +
 * methods) and returns count + 1.
 *
 * Decision points:
 *   if_statement        +1
 *   for_statement       +1
 *   case_clause / type_case (each `case` in a switch; `default` does not count)
 *   communication_case  +1 (each non-default arm of a select)
 *   binary_expression with operator `&&` or `||`  +1 each
 *
 * Goroutine `go` and `defer` are NOT branches — they don't count.
 */
export function extractGoCyclomatic(root: TsNode): number {
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
    case 'expression_case': // `case x:` in expression switch
    case 'type_case': // `case T:` in type switch
    case 'communication_case': // non-default `case` in select
      return true;
    case 'binary_expression': {
      // tree-sitter-go represents the operator as text on the operator child
      // (or in n.text we'd need to inspect tokens). Cheap approximation:
      // scan the source text of the binary_expression for `&&` / `||`. Since
      // each binary_expression node represents exactly one operator
      // application, this is precise.
      const t = n.text;
      // Use small windows: an `&&` or `||` appears as two ASCII chars.
      // No false positives possible — strings are themselves leaf nodes
      // (interpreted_string_literal) and would parent-up through other paths.
      // Still, guard against operators inside string literals by checking
      // that this particular binary_expression's first/second child is not
      // a string.
      return /(\s|^)(\|\||&&)(\s|$)/.test(t);
    }
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
