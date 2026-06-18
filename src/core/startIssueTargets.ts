export function extractIssueIdTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([^`'"]*[A-Za-z][^`'"]*-[^`'"]+)[`'"]/);
  if (wrapped?.[1] && isIssueIdTarget(wrapped[1])) return wrapped[1];

  const labeled = compactIntent.match(
    /\b(?:issue(?:\s+id)?|id|rule)\s+(?:is\s+|named\s+)?([A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+)\b/i,
  );
  if (labeled?.[1] && isIssueIdTarget(labeled[1])) return labeled[1];

  const issueLike = compactIntent.match(
    /\b([A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+)\b/,
  );
  if (issueLike?.[1] && isIssueIdTarget(issueLike[1])) return issueLike[1];

  return undefined;
}

function isIssueIdTarget(target: string): boolean {
  return (
    /^[A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+$/.test(target) &&
    !target.includes('/') &&
    target.toLowerCase() !== 'fix-suggest'
  );
}
