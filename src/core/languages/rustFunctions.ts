import type { FunctionInfo } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

const RUST_DECISION_NODES = new Set([
  'if_expression',
  'for_expression',
  'while_expression',
  'loop_expression',
  'try_expression',
]);

/**
 * Per-function McCabe CC for Rust. Walks `function_item` nodes (free
 * functions and trait/impl methods). Methods inside `impl SomeType { fn m() }`
 * are named `SomeType.m`; trait methods inside `trait Foo { fn bar() }` are
 * named `Foo.bar`. Free functions stay bare (`do_it`).
 *
 * Closures and async blocks are NOT extracted as separate functions in 1.1
 * (analogous to Go func literals); their decision points fold into the
 * enclosing function.
 */
export function extractRustFunctions(root: TsNode): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  walk(root, null, out);
  return out;
}

function walk(node: TsNode, ownerName: string | null, out: FunctionInfo[]): void {
  // `impl SomeType { … }` and `impl Trait for SomeType { … }` — methods inside
  // are scoped by the impl's type.
  if (node.type === 'impl_item') {
    const type = node.childForFieldName ? node.childForFieldName('type') : null;
    const name = type?.text ?? ownerName;
    const body = node.childForFieldName ? node.childForFieldName('body') : null;
    if (body) {
      for (const child of body.namedChildren) walk(child, name, out);
    }
    return;
  }
  // `trait Foo { fn bar() }` — methods inside scope by the trait name.
  if (node.type === 'trait_item') {
    const tname = node.childForFieldName ? node.childForFieldName('name') : null;
    const traitName = tname?.text ?? ownerName;
    const body = node.childForFieldName ? node.childForFieldName('body') : null;
    if (body) {
      for (const child of body.namedChildren) walk(child, traitName, out);
    }
    return;
  }
  // `mod foo { … }` — keep the same ownerName but recurse so nested fns
  // outside an impl/trait still get extracted.
  if (node.type === 'mod_item') {
    const body = node.childForFieldName ? node.childForFieldName('body') : null;
    if (body) {
      for (const child of body.namedChildren) walk(child, ownerName, out);
    }
    return;
  }

  if (node.type === 'function_item' || node.type === 'function_signature_item') {
    const nameNode = node.childForFieldName ? node.childForFieldName('name') : findChild(node, 'identifier');
    const baseName = nameNode?.text ?? '<anonymous>';
    const fnName = ownerName ? `${ownerName}.${baseName}` : baseName;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const { cc, callSites } = analyzeBody(node);
    out.push({ name: fnName, line, endLine, cyclomaticComplexity: cc, callSites });
    return;
  }

  for (const child of node.namedChildren) walk(child, ownerName, out);
}

function analyzeBody(fnNode: TsNode): { cc: number; callSites: string[] } {
  let count = 0;
  const calls = new Set<string>();
  const body = fnNode.childForFieldName ? fnNode.childForFieldName('body') : null;
  if (!body) return { cc: 1, callSites: [] };
  walkSkipNested(body, (n) => {
    if (RUST_DECISION_NODES.has(n.type)) {
      count++;
      return;
    }
    if (n.type === 'match_arm') {
      const arm = n.namedChildren[0];
      if (!arm) {
        count++;
        return;
      }
      if (arm.type === 'wildcard_pattern') return;
      if (arm.type === 'match_pattern') {
        const inner = arm.namedChildren[0];
        if (!inner) {
          if (arm.text.trim() === '_') return;
          count++;
          return;
        }
        if (inner.type === 'wildcard_pattern') return;
      }
      count++;
      return;
    }
    if (n.type === 'binary_expression' && /(\s|^)(\|\||&&)(\s|$)/.test(n.text)) {
      count++;
      return;
    }
    if (n.type === 'call_expression') {
      const fn = n.childForFieldName ? n.childForFieldName('function') : (n.namedChildren[0] ?? null);
      const name = rustCalleeName(fn);
      if (name) calls.add(name);
    }
  });
  return { cc: count + 1, callSites: [...calls] };
}

function rustCalleeName(node: TsNode | null): string | null {
  if (!node) return null;
  switch (node.type) {
    case 'identifier':
    case 'field_identifier':
      return node.text;
    case 'scoped_identifier': {
      let last: string | null = null;
      for (const c of node.namedChildren) {
        if (c.type === 'identifier') last = c.text;
      }
      return last;
    }
    case 'field_expression': {
      const field = node.childForFieldName ? node.childForFieldName('field') : null;
      if (field) return rustCalleeName(field);
      const named = node.namedChildren;
      return named.length > 0 ? rustCalleeName(named[named.length - 1]) : null;
    }
    case 'generic_function': {
      // foo::<T>(args) — the function child holds the name.
      const fn = node.childForFieldName ? node.childForFieldName('function') : null;
      return rustCalleeName(fn);
    }
    default:
      return null;
  }
}

function walkSkipNested(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) {
    if (
      child.type === 'function_item' ||
      child.type === 'function_signature_item' ||
      child.type === 'closure_expression'
    ) {
      // Skip: nested fns and closures emit their own entries (or, in the case
      // of closures, fold into the parent — but their decision points should
      // not double-count into the parent's CC).
      continue;
    }
    walkSkipNested(child, visit);
  }
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) if (c.type === type) return c;
  return null;
}
