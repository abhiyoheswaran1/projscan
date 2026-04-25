interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for a tree-sitter-ruby AST.
 *
 * Decision points:
 *   if, elsif, unless                 +1 each (else does not count)
 *   while, until, for                 +1 each
 *   case + each `when`                +1 per `when` (the `case` itself does NOT
 *                                       add - only the branch labels do)
 *   rescue                            +1
 *   conditional (ternary `?:`)        +1
 *   binary with `&&` / `||` / `and` / `or`   +1 each
 */
export function extractRubyCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if':
    case 'elsif':
    case 'unless':
    case 'while':
    case 'until':
    case 'for':
    case 'when':
    case 'rescue':
    case 'conditional':
      return true;
    case 'binary': {
      const t = n.text;
      // Ruby supports both symbolic (&&, ||) and word (and, or) operators.
      return /(\s|^)(\|\||&&)(\s|$)/.test(t) || /\b(and|or)\b/.test(t);
    }
    default:
      return false;
  }
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
