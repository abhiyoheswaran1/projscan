interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-swift AST.
 *
 * Decision points in Swift:
 *   if_statement                   +1
 *   guard_statement                +1 (short-circuits to its `else`)
 *   for_statement                  +1
 *   while_statement                +1
 *   repeat_while_statement         +1
 *   do_statement                   +1
 *   catch_block / catch_clause     +1 each
 *   switch_entry (non-default)     +1
 *   conjunction_expression         +1 (Swift's `&&`)
 *   disjunction_expression         +1 (Swift's `||`)
 *
 * The optional-chaining `?.` and nil-coalescing `??` operators do NOT count.
 */
export function extractSwiftCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_statement':
    case 'guard_statement':
    case 'for_statement':
    case 'while_statement':
    case 'repeat_while_statement':
    case 'do_statement':
    case 'catch_block':
    case 'catch_clause':
    case 'conjunction_expression':
    case 'disjunction_expression':
      return true;
    case 'switch_entry': {
      // Default arm has no `switch_pattern` / `case_label` child; non-default
      // always does. Structural detection is more reliable than text-regex.
      const isDefault = !n.namedChildren.some((c) => c.type === 'switch_pattern' || c.type === 'case_label');
      return !isDefault;
    }
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
