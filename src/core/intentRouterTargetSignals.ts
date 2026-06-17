export function hasFilePathTarget(intent: string): boolean {
  return /(?:^|\s)[A-Za-z0-9_./:@-]+\.[A-Za-z0-9]{1,12}(?=[\s?!.,;:]|$)/.test(intent);
}

export function hasEnvVarTarget(intent: string): boolean {
  return (
    /\bprocess\.env\.[A-Za-z_][A-Za-z0-9_]*\b/.test(intent) ||
    /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(intent)
  );
}

export function hasQuotedTextTarget(intent: string): boolean {
  return /(["'`])\S.{0,200}?\1/.test(intent);
}

export function hasPackageRemovalTarget(intent: string): boolean {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const actionFirst = compactIntent.match(
    /\b(?:remove|drop|uninstall)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  const targetFirst = compactIntent.match(
    /\b(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:safe\s+to\s+)?(?:remove|drop|uninstall)\b/i,
  );
  const match = actionFirst ?? targetFirst;
  const target = match?.[1]?.toLowerCase();
  if (!target) return false;
  return ![
    'this',
    'that',
    'it',
    'thing',
    'file',
    'files',
    'function',
    'method',
    'class',
    'symbol',
    'code',
    'for',
    'safe',
    'safely',
    'carefully',
    'docs',
    'doc',
    'documentation',
    'document',
    'readme',
    'changelog',
    'examples',
    'example',
    'guide',
  ].includes(target);
}

export function hasPackageChangeTarget(intent: string): boolean {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const actionFirst = compactIntent.match(
    /\b(?:bump|upgrade|update)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  const target = actionFirst?.[1]?.toLowerCase();
  if (!target) return false;
  return ![
    'this',
    'that',
    'it',
    'thing',
    'file',
    'files',
    'function',
    'method',
    'class',
    'symbol',
    'code',
    'for',
    'docs',
    'doc',
    'documentation',
    'document',
    'readme',
    'changelog',
    'examples',
    'example',
    'guide',
  ].includes(target);
}
