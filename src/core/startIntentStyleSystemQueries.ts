export function extractStyleSystemQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\b(?:why|failing|failed|failure|failures|broken|error|errors|runtime|production|prod|outage|incident)\b/i.test(
      compactIntent,
    )
  ) {
    return undefined;
  }

  if (/\bdesign\s+tokens?\b/i.test(compactIntent)) return 'design tokens';
  if (/\btailwind\s+themes?\b/i.test(compactIntent)) return 'Tailwind theme';
  if (/\bglobal\s+css\b/i.test(compactIntent)) return 'global CSS';

  const cssModule = compactIntent.match(/\b(?:which|what)\s+css\s+modules?\s+styles?\s+(.+?)$/i);
  if (cssModule?.[1]) return `${unwrapTarget(cssModule[1].trim())} CSS module`;

  if (/\bdark\s+mode\b/i.test(compactIntent)) return 'dark mode';
  if (/\bbreakpoints?\b/i.test(compactIntent)) return 'breakpoints';

  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
