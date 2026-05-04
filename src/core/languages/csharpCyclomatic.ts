interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for tree-sitter-c-sharp.
 *
 * Decision points:
 *   if_statement                                 +1
 *   for_statement / foreach_statement            +1 each
 *   while_statement / do_statement               +1 each
 *   switch_section                               +1 per non-default arm
 *   switch_expression_arm                        +1 per non-discard arm
 *   catch_clause                                 +1 each
 *   conditional_expression (ternary `?:`)        +1
 *   binary_expression with `&&` / `||` / `??`    +1 each
 *
 * `else if` is modeled by the grammar as `else_clause > if_statement`, so
 * the inner if_statement counts naturally.
 */
export function extractCsharpCyclomatic(root: TsNode): number {
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
    case 'foreach_statement':
    case 'while_statement':
    case 'do_statement':
    case 'catch_clause':
    case 'conditional_expression':
      return true;
    case 'switch_section': {
      // A switch_section starts with `case X:` or `default:`. The default
      // arm is the fallthrough; everything else is a branch. Note: each
      // case label gets its own switch_section even with `case 1: case 2:`.
      return !/^\s*default\b/.test(n.text);
    }
    case 'switch_expression_arm': {
      // `_ =>` (discard) is the fallthrough; everything else is a branch.
      const t = n.text.trimStart();
      return !/^_\s*=>/.test(t);
    }
    case 'binary_expression': {
      const t = n.text;
      if (/(\s|^)(\|\||&&|\?\?)(\s|$)/.test(t)) return true;
      return false;
    }
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
