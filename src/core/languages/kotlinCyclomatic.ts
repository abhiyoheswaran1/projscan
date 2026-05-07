interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-kotlin AST.
 *
 * Decision points in Kotlin:
 *   if_expression                +1 (the `if` itself; `else` does not count)
 *   for_statement                +1
 *   while_statement              +1
 *   do_while_statement           +1
 *   try_expression               +1 (success vs throw paths)
 *   catch_block                  +1 (each catch is a separate handler)
 *   when_entry (non-else)        +1 (each non-else `when` arm is a branch)
 *   conjunction_expression       +1 (Kotlin's `&&`)
 *   disjunction_expression       +1 (Kotlin's `||`)
 *
 * The Elvis operator `?:` and safe-call `?.` do NOT count as branches —
 * matches the convention used elsewhere in projscan and most analyzers.
 */
export function extractKotlinCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_expression':
    case 'for_statement':
    case 'while_statement':
    case 'do_while_statement':
    case 'try_expression':
    case 'catch_block':
    case 'conjunction_expression':
    case 'disjunction_expression':
      return true;
    case 'when_entry': {
      // The `else` arm has no `when_condition` child — the `else` keyword is
      // an anonymous token in tree-sitter-kotlin, so checking child text
      // doesn't work reliably. Non-else arms always carry at least one
      // `when_condition` (multi-value arms like `1, 2 ->` carry several).
      const hasCondition = n.namedChildren.some((c) => c.type === 'when_condition');
      return hasCondition;
    }
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
