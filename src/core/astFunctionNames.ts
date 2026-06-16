import type { Node } from '@babel/types';

export function nameForFunctionNode(
  node: Node,
  parentClassName: string | null,
  bindingName: string | null,
): string {
  const candidates = [
    functionDeclarationName(node, bindingName),
    methodFunctionName(node, parentClassName),
    functionExpressionName(node),
    bindingName,
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return '<anonymous>';
}

function functionDeclarationName(node: Node, bindingName: string | null): string | null {
  if (node.type !== 'FunctionDeclaration') return null;
  const id = (node as { id?: { name?: string } }).id;
  return id?.name ?? bindingName ?? '<anonymous>';
}

function methodFunctionName(node: Node, parentClassName: string | null): string | null {
  if (!isMethodFunctionNode(node)) return null;
  const key = (node as { key?: { type: string; name?: string; value?: string } }).key;
  const methodName = methodKeyName(key);
  return parentClassName ? `${parentClassName}.${methodName}` : methodName;
}

function isMethodFunctionNode(node: Node): boolean {
  return (
    node.type === 'ClassMethod' ||
    node.type === 'ObjectMethod' ||
    node.type === 'ClassPrivateMethod'
  );
}

function methodKeyName(
  key: { type: string; name?: string; value?: string } | undefined,
): string {
  if (!key) return '<anonymous>';
  if (key.type === 'Identifier') return key.name ?? '<anonymous>';
  if (key.type === 'StringLiteral') return key.value ?? '<anonymous>';
  if (key.type === 'PrivateName') return privateMethodName(key);
  return '<anonymous>';
}

function privateMethodName(key: { type: string }): string {
  const inner = (key as unknown as { id?: { name?: string } }).id;
  return inner?.name ? `#${inner.name}` : '<anonymous>';
}

function functionExpressionName(node: Node): string | null {
  if (node.type !== 'FunctionExpression') return null;
  const id = (node as { id?: { name?: string } }).id;
  return id?.name ?? null;
}
