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
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc, callSites });
    return;
  }

  for (const child of node.namedChildren) walk(child, className, out);
}

function analyzeBody(fnNode: TsNode): { cc: number; callSites: string[] } {
  let count = 0;
  const calls = new Set<string>();
  const body = fnNode.childForFieldName ? fnNode.childForFieldName('body') : null;
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (RUBY_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'binary') {
      if (/(\s|^)(\|\||&&)(\s|$)/.test(n.text) || /\b(and|or)\b/.test(n.text)) count++;
      return;
    }
    if (n.type === 'call' || n.type === 'method_call') {
      const name = rubyCalleeName(n);
      if (name) calls.add(name);
      return;
    }
    if (n.type === 'identifier') {
      // Ruby allows calling methods without parens or receiver: `foo` is a
      // call. Distinguishing identifier-as-call vs identifier-as-local is
      // beyond what we can do without scope tracking; skip the bare-id case
      // and rely on `call` / `method_call` shapes (which cover `foo()`,
      // `obj.foo`, and `foo arg` per the grammar).
      return;
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function rubyCalleeName(node: TsNode): string | null {
  // tree-sitter-ruby's `call` has a `method` field for the called name.
  const m = node.childForFieldName ? node.childForFieldName('method') : null;
  if (m) {
    if (m.type === 'identifier' || m.type === 'constant') return m.text;
    return m.text;
  }
  // Fallback: last identifier-bearing child.
  for (let i = node.namedChildren.length - 1; i >= 0; i--) {
    const c = node.namedChildren[i];
    if (c.type === 'identifier' || c.type === 'constant') return c.text;
  }
  return null;
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
