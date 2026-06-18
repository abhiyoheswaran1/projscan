export function extractNavigationLayoutQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  const sidebarNav = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:sidebar\s+)?(?:nav|navigation|menu)\s+items?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (sidebarNav?.[1]) return `${unwrapTarget(sidebarNav[1].trim())} sidebar nav item`;

  const breadcrumb = compactIntent.match(
    /\b(?:which|what)\s+breadcrumbs?\s+(?:renders?|shows?|for|of)\s+(.+?)$/i,
  );
  if (breadcrumb?.[1]) return `${unwrapTarget(breadcrumb[1].trim())} breadcrumb`;

  const pageTitle = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?page\s+(?:title|metadata|meta)\s+(?:set|sets|defined|configured)\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (pageTitle?.[1]) return `${unwrapTarget(pageTitle[1].trim())} page title`;

  const nextLayout = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?next(?:\.js|js)?\s+layouts?\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (nextLayout?.[1]) return `${unwrapTarget(nextLayout[1].trim())} Next.js layout`;

  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
