export function extractCommunicationArtifactQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const welcomeEmail = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\bemail\s+templates?)\b/i,
  );
  if (welcomeEmail?.[1]) return unwrapTarget(welcomeEmail[1].trim());

  const emailCopy = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\bemail\s+copy)\b/i,
  );
  if (emailCopy?.[1]) return unwrapTarget(emailCopy[1].trim());

  const pushCopy = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?push\s+notifications?\s+copy\s+(?:for|of)\s+(.+?)$/i,
  );
  if (pushCopy?.[1]) return `${unwrapTarget(pushCopy[1].trim())} push notification copy`;

  if (/\bsms\s+verification\s+templates?\b/i.test(compactIntent))
    return 'SMS verification template';

  if (/\breceipt\s+email\b/i.test(compactIntent) && /\btemplates?\b/i.test(compactIntent))
    return 'receipt email template';

  if (/\binvoice\s+pdf\b/i.test(compactIntent)) return 'invoice PDF';

  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
