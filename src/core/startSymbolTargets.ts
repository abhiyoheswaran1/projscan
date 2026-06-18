export function extractSymbolTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([A-Za-z_$][\w$]*)[`'"]/);
  if (wrapped?.[1]) return wrapped[1];
  const definitionMatch = compactIntent.match(
    /\bwhere\s+(?:is|are)\s+(?:the\s+)?([A-Za-z_$][\w$]*)\s+(?:defined|declared|implemented)\b/i,
  );
  if (definitionMatch?.[1] && isSymbolNameTarget(definitionMatch[1])) return definitionMatch[1];
  const match = compactIntent.match(
    /\b(?:symbol|function|class|const|type|interface)\s+([A-Za-z_$][\w$]*)\b/i,
  );
  return match?.[1] && isSymbolNameTarget(match[1]) ? match[1] : undefined;
}

export function isExactSymbolTarget(target: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(target);
}

function isSymbolNameTarget(target: string): boolean {
  return ![
    'symbol',
    'function',
    'class',
    'const',
    'type',
    'interface',
    'defined',
    'declared',
    'implemented',
  ].includes(target.toLowerCase());
}
