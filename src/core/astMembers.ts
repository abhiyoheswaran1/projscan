import type { Node } from '@babel/types';

export function bindingIdentifierName(node: Node | null | undefined): string | null {
  return bindingIdentifierNames(node)[0] ?? null;
}

export function bindingIdentifierNames(node: Node | null | undefined): string[] {
  if (!node) return [];
  if (node.type === 'Identifier') {
    const name = (node as { name?: string }).name;
    return name ? [name] : [];
  }
  if (node.type === 'AssignmentPattern') {
    return bindingIdentifierNames((node as { left?: Node }).left);
  }
  if (node.type === 'RestElement') {
    return bindingIdentifierNames((node as { argument?: Node }).argument);
  }
  if (node.type === 'ObjectPattern') {
    const names: string[] = [];
    for (const property of (node as { properties?: Node[] }).properties ?? []) {
      names.push(...bindingNamesFromObjectPatternProperty(property));
    }
    return names;
  }
  if (node.type === 'ArrayPattern') {
    const names: string[] = [];
    for (const element of (node as { elements?: Array<Node | null> }).elements ?? []) {
      names.push(...bindingIdentifierNames(element));
    }
    return names;
  }
  return [];
}

function bindingNamesFromObjectPatternProperty(property: Node): string[] {
  if (!property) return [];
  if (property.type === 'RestElement') {
    return bindingIdentifierNames((property as { argument?: Node }).argument);
  }
  if (property.type !== 'ObjectProperty') return [];
  const value = (property as { value?: Node }).value;
  return bindingIdentifierNames(value);
}

export function isMemberExpressionNode(node: Node): boolean {
  return node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression';
}

/**
 * Walk a member-expression chain (`a.b.c`, `req.body.x`, `process.env.SECRET`)
 * and add the rightmost ident of each link to `out`. Skips the leftmost root
 * (which is usually a binding name like `req` or `obj` — not interesting for
 * taint matching). Computed-property accesses (`a[i]`) contribute nothing.
 */
export function collectMemberReadIdents(node: Node, out: Set<string>): void {
  for (const name of memberReadIdentNames(node)) out.add(name);
}

function memberReadIdentNames(node: Node): string[] {
  const names: string[] = [];
  let cur: Node | null = node;
  while (cur && isMemberExpressionNode(cur)) {
    const name = memberReadIdentifierName(cur);
    if (name) names.push(name);
    cur = memberExpressionObject(cur);
  }
  return names;
}

function memberReadIdentifierName(node: Node): string | null {
  const member = node as { property?: Node; computed?: boolean };
  if (member.computed) return null;
  return bindingIdentifierName(member.property);
}

function memberExpressionObject(node: Node): Node | null {
  return (node as { object?: Node }).object ?? null;
}

export function collectMemberAliases(node: Node, out: Set<string>): void {
  const context = memberAliasContext(node);
  if (!context) return;
  for (const property of context.properties) {
    const alias = memberAliasFromObjectProperty(property, context.objectName);
    if (alias) out.add(alias);
  }
}

function memberAliasContext(node: Node): { objectName: string; properties: Node[] } | null {
  const decl = node as { id?: Node; init?: Node | null };
  if (!decl.id || decl.id.type !== 'ObjectPattern' || !decl.init) return null;
  const objectName = babelQualifiedMemberName(decl.init) ?? babelCalleeName(decl.init);
  if (!objectName) return null;
  return { objectName, properties: (decl.id as { properties?: Node[] }).properties ?? [] };
}

function memberAliasFromObjectProperty(property: Node, objectName: string): string | null {
  if (!property || property.type !== 'ObjectProperty') return null;
  const prop = property as { key?: Node; value?: Node; computed?: boolean };
  if (prop.computed || !prop.key || !prop.value) return null;
  const keyName = babelMemberPropertyName(prop.key);
  const aliasName = bindingIdentifierName(prop.value);
  return keyName && aliasName ? aliasName + '=' + objectName + '.' + keyName : null;
}

export function babelCalleeName(node: Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return (node as { name?: string }).name ?? null;
  if (isMemberExpressionNode(node)) {
    const property = (node as { property?: Node }).property;
    if (property) return babelCalleeName(property);
  }
  return null;
}

export function babelQualifiedMemberName(node: Node | null | undefined): string | null {
  const member = memberExpressionParts(node);
  if (!member) return null;
  const objectName = babelMemberObjectName(member.object);
  const propertyName = babelMemberPropertyName(member.property);
  return objectName && propertyName ? `${objectName}.${propertyName}` : null;
}

function memberExpressionParts(
  node: Node | null | undefined,
): { object: Node; property: Node } | null {
  if (!node || !isMemberExpressionNode(node)) return null;
  const member = node as { object?: Node; property?: Node; computed?: boolean };
  if (member.computed || !member.object || !member.property) return null;
  return { object: member.object, property: member.property };
}

function babelMemberObjectName(node: Node): string | null {
  if (node.type === 'Identifier' || node.type === 'ThisExpression') return babelCalleeName(node);
  return babelQualifiedMemberName(node);
}

function babelMemberPropertyName(node: Node): string | null {
  if (node.type === 'Identifier') return (node as { name?: string }).name ?? null;
  if (node.type === 'StringLiteral') return (node as { value?: string }).value ?? null;
  return null;
}
