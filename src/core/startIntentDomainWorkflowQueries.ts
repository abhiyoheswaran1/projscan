export function extractDomainWorkflowQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  if (/\bpassword\s+reset\b/i.test(compactIntent)) return 'password reset';

  const invite = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\binvite\s+flow)\b/i,
  );
  if (invite?.[1]) return unwrapTarget(invite[1].trim());

  if (/\bonboarding\s+flow\b/i.test(compactIntent)) return 'onboarding flow';

  const csvExport = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?csv\s+exports?\s+(?:for|of)\s+(.+?)$/i,
  );
  if (csvExport?.[1]) return `${unwrapTarget(csvExport[1].trim())} CSV export`;

  if (
    /\baudit\s+logs?\s+entries\b/i.test(compactIntent) ||
    /\baudit\s+log\s+entries\b/i.test(compactIntent)
  )
    return 'audit log entries';

  const refund = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?refund\s+handling\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (refund?.[1]) return `${unwrapTarget(refund[1].trim())} refund handling`;

  if (/\bsubscription\s+renewal\b/i.test(compactIntent)) return 'subscription renewal';

  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
