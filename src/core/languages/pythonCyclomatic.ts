/** Minimal tree-sitter node surface we depend on. Mirrors pythonImports.ts. */
interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * Compute file-level McCabe cyclomatic complexity from a tree-sitter-python
 * AST. Counts decision points across the entire file (module + nested
 * functions/classes) and returns count + 1.
 *
 * Decision points: if/elif, for, while, except, conditional expression,
 * boolean operators (and/or each add one), and `if` clauses inside
 * comprehensions. The plain `else` branch is the fall-through path and does
 * not count.
 */
export function extractPythonCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_statement':
    case 'elif_clause':
    case 'for_statement':
    case 'while_statement':
    case 'except_clause':
    case 'conditional_expression':
    case 'for_in_clause': // comprehension `for`
    case 'if_clause': // comprehension `if`
    case 'case_clause': // match/case (Python 3.10+)
      return true;
    case 'boolean_operator':
      // Each `and` / `or` introduces a branch. tree-sitter-python emits one
      // boolean_operator node per logical operator, so each occurrence = +1.
      return true;
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    walk(child, visit);
  }
}
