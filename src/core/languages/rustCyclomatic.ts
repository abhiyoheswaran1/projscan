interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-rust AST.
 *
 * Decision points in Rust:
 *   if_expression                        +1 (the `if` itself; `else` does not count)
 *   else_clause with `if`                +1 (the chained `else if`)
 *   for_expression                       +1
 *   while_expression                     +1
 *   loop_expression                      +1 (an unconditional `loop` is still one branch with
 *                                            its `break` exits)
 *   match_arm                            +1 per non-wildcard arm; the `_` arm does NOT count
 *   try_expression                       +1 (the `?` operator: success vs error path)
 *   binary_expression with `&&` / `||`   +1 each (short-circuit)
 *
 * The arrow `=>` between match arm patterns and bodies is the actual branch.
 * Wildcard arms (`_ =>`) are the fall-through and don't add a path.
 */
export function extractRustCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_expression':
    case 'for_expression':
    case 'while_expression':
    case 'loop_expression':
    case 'try_expression':
      return true;
    case 'match_arm': {
      // Non-wildcard arms count. tree-sitter-rust wraps the pattern in a
      // `match_pattern` node whose inner is the actual pattern; a bare `_`
      // arm has no named children inside `match_pattern` (the `_` is an
      // anonymous token), so we also fall back to the text-equality check.
      const arm = n.namedChildren[0];
      if (!arm) return true;
      if (arm.type === 'wildcard_pattern') return false;
      if (arm.type === 'match_pattern') {
        const inner = arm.namedChildren[0];
        if (!inner) return arm.text.trim() !== '_';
        if (inner.type === 'wildcard_pattern') return false;
      }
      return true;
    }
    case 'binary_expression': {
      // tree-sitter-rust exposes the operator as text within the binary_expression.
      // Match `&&` / `||` with whitespace boundaries to avoid catching them inside strings.
      return /(\s|^)(\|\||&&)(\s|$)/.test(n.text);
    }
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
