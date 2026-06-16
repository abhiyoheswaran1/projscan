import type { Node } from '@babel/types';

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassMethod',
  'ObjectMethod',
  'ClassPrivateMethod',
]);

export function isFunctionNode(node: Node): boolean {
  return FUNCTION_TYPES.has(node.type);
}
