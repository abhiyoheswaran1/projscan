export function isGenericReferenceTarget(target: string): boolean {
  return /^(?:it|this|that|thing|symbol|function|method|file|change|changes|break|breaks|breaking|safely|safe|carefully)$/i.test(
    target,
  );
}

export function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
