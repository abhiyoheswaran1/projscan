export function extractAuthorizationQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const rbac = compactIntent.match(/\brbac\b/i);
  if (rbac) return rbac[0].toUpperCase();

  const permissionScope = compactIntent.match(
    /\b(?:where\s+(?:are|is)|which|what|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?permissions?\s+(?:checked\s+)?(?:for|on|in)\s+(.+?)$/i,
  );
  if (permissionScope?.[1]) return `${unwrapTarget(permissionScope[1].trim())} permissions`;

  const roleAccess = compactIntent.match(/\b(?:which|what)\s+roles?\s+(?:can\s+)?access\s+(.+?)$/i);
  if (roleAccess?.[1]) return `${unwrapTarget(roleAccess[1].trim())} role access`;

  const guard = compactIntent.match(
    /\b(?:what|which|where\s+(?:are|is))\s+guards?\s+(?:the\s+)?(.+?)$/i,
  );
  if (guard?.[1]) return `${unwrapTarget(guard[1].trim())} guard`;

  const policy = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:authorization\s+)?polic(?:y|ies)\s+(?:for|on|in)\s+(.+?)$/i,
  );
  if (policy?.[1]) return `${unwrapTarget(policy[1].trim())} authorization policy`;

  if (/\b(?:what|which)\s+routes?\s+(?:require|requires|required)\s+login\b/i.test(compactIntent))
    return 'login routes';
  if (/\bwhere\s+(?:is|are)\s+login\s+required\b/i.test(compactIntent)) return 'login required';

  return undefined;
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
