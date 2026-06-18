export function extractFrontendPageRouteQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\b(?:why|returning|returns|failing|failed|failure|failures|production|prod|down|outage|incident|runtime|crash|crashes|crashing)\b/i.test(
      compactIntent,
    )
  ) {
    return undefined;
  }

  const pathPage = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(\/[A-Za-z0-9_./:{}-]+)\s+pages?\s+(?:rendered|handled|defined|located|live|lives)\b/i,
  );
  if (pathPage?.[1]) return `${pathPage[1].trim()} page`;

  const pageRendersPath = compactIntent.match(
    /\b(?:which|what)\s+pages?\s+(?:renders?|shows?)\s+(\/[A-Za-z0-9_./:{}-]+)\b/i,
  );
  if (pageRendersPath?.[1]) return `${pageRendersPath[1].trim()} page`;

  const routeSegment = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?routes?\s+segments?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (routeSegment?.[1]) return `${unwrapTarget(routeSegment[1].trim())} route segment`;

  if (/\bnot[-\s]?found\s+pages?\s+(?:handled|defined|located|live|lives)\b/i.test(compactIntent))
    return 'not-found page';
  if (/\b404\s+pages?\s+(?:handled|defined|located|live|lives)\b/i.test(compactIntent))
    return '404 page';

  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
