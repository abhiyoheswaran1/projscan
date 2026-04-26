import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const RUBY_DECISION_NODES = new Set([
  'if',
  'elsif',
  'unless',
  'while',
  'until',
  'for',
  'when',
  'rescue',
  'conditional',
]);

/**
 * Per-method McCabe CC for Ruby. Walks `method` (def) and `singleton_method`
 * (def self.foo) nodes inside class/module bodies. Methods are named
 * `Class.method` (or `Module.method`).
 */
export function extractRubyFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, className: string | null, out: FunctionInfo[]): void {
  if (node.type === 'class' || node.type === 'module') {
    const nameNode = node.childForFieldName ? node.childForFieldName('name') : findChild(node, 'constant');
    const cls = nameNode?.text ?? null;
    const body = node.childForFieldName ? node.childForFieldName('body') : null;
    if (body) {
      for (const child of body.namedChildren) walk(child, cls, out);
    } else {
      for (const child of node.namedChildren) walk(child, cls, out);
    }
    return;
  }

  if (node.type === 'method' || node.type === 'singleton_method') {
    const nameNode = node.childForFieldName ? node.childForFieldName('name') : findChild(node, 'identifier');
    const baseName = nameNode?.text ?? '<anonymous>';
    const fnName = className ? `${className}.${baseName}` : baseName;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const cc = countDecisions(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc });
    return;
  }

  for (const child of node.namedChildren) walk(child, className, out);
}

function countDecisions(fnNode: TsNode): number {
  let count = 0;
  const body = fnNode.childForFieldName ? fnNode.childForFieldName('body') : null;
  if (!body) return 1;
  walkSkipNested(body, (n) => {
    if (RUBY_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'binary') {
      if (/(\s|^)(\|\||&&)(\s|$)/.test(n.text) || /\b(and|or)\b/.test(n.text)) count++;
    }
  });
  return count + 1;
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'method' ||
      child.type === 'singleton_method' ||
      child.type === 'class' ||
      child.type === 'module' ||
      child.type === 'lambda' ||
      child.type === 'block'
    ) {
      // Skip blocks too: in Ruby, `each { |x| ... }` is a block; treating it
      // as opaque keeps method CC tight to the method's own logic. (This is
      // a tradeoff - some style guides include block branches. We pick the
      // more conservative reading.)
      continue;
    }
    walkSkipNested(child, visit);
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) if (c.type === type) return c;
  return null;
}
