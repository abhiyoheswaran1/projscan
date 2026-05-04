interface TsNode {
  type: string;
  text: string;
  namedChildren: TsNode[];
}

/**
 * File-level McCabe cyclomatic complexity for tree-sitter-php.
 *
 * Decision points:
 *   if_statement                                 +1
 *   else_if_clause / elseif_clause               +1 each (the `else` does NOT count)
 *   for_statement / foreach_statement            +1 each
 *   while_statement / do_statement               +1 each
 *   case_statement / match_condition_list        +1 per non-default arm (default does NOT count)
 *   catch_clause                                 +1 each
 *   conditional_expression (ternary `?:`)        +1
 *   binary_expression with `&&` / `||`           +1 each
 *   binary_expression with `??` (null coalesce)  +1
 *   `and` / `or` word operators                  +1 each (text-detected; binary_expression doesn't
 *                                                  distinguish them from `&&` / `||` at the node-type
 *                                                  level)
 *
 * Hat tip to existing analyzers (eslint, phpmetrics) that follow these
 * conventions; we match them so our scores read like everyone else's.
 */
export function extractPhpCyclomatic(root: TsNode): number {
  let decisions = 0;
  walk(root, (n) => {
    if (isDecisionPoint(n)) decisions++;
  });
  return decisions + 1;
}

function isDecisionPoint(n: TsNode): boolean {
  switch (n.type) {
    case 'if_statement':
    case 'else_if_clause':
    case 'elseif_clause':
    case 'for_statement':
    case 'foreach_statement':
    case 'while_statement':
    case 'do_statement':
    case 'catch_clause':
    case 'conditional_expression':
      return true;
    case 'case_statement': {
      // `default:` is the fallthrough, not a branch.
      return !/^\s*default\b/.test(n.text);
    }
    case 'match_condition_list': {
      // Each match condition list is one arm of a `match { ... }`. Arms
      // matching anything but `default` count.
      return !/^\s*default\b/.test(n.text);
    }
    case 'binary_expression': {
      const t = n.text;
      // PHP supports both symbolic (`&&`, `||`, `??`) and word (`and`, `or`)
      // boolean operators. Match each occurrence at most once per node.
      if (/(\s|^)(\|\||&&|\?\?)(\s|$)/.test(t)) return true;
      if (/\b(and|or)\b/.test(t)) return true;
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
