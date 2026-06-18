export function extractBackgroundWorkQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const subjectPattern =
    'background\\s+jobs?|cron\\s+jobs?|scheduled\\s+tasks?|queues?\\s+processors?|workers?\\s+processors?|schedulers?|workers?|queues?|processors?';
  const findMatch = compactIntent.match(
    new RegExp(
      `\\b(?:find|locate|search(?:\\s+for)?|lookup)\\s+(?:the\\s+)?(.*?\\b(?:${subjectPattern})\\b)`,
      'i',
    ),
  );
  if (findMatch?.[1] && isBackgroundWorkTarget(findMatch[1]))
    return unwrapTarget(findMatch[1].trim()).replace(/^the\s+/i, '');

  const lookupMatch = compactIntent.match(
    new RegExp(
      `\\b(?:where\\s+(?:are|is)|which|what)\\s+(?:the\\s+)?(.*?\\b(?:${subjectPattern})\\b)(?:\\s+(?:exist|exists|defined|located|handled|run|runs))?$`,
      'i',
    ),
  );
  if (lookupMatch?.[1] && isBackgroundWorkTarget(lookupMatch[1]))
    return unwrapTarget(lookupMatch[1].trim()).replace(/^the\s+/i, '');

  const processMatch = compactIntent.match(
    /\bwhich\s+(queues?|workers?|processors?)\s+(?:processes?|handles?)\s+(.+?)$/i,
  );
  if (processMatch?.[1] && processMatch[2])
    return `${unwrapTarget(processMatch[2].trim())} ${processMatch[1].toLowerCase()}`;
  return undefined;
}

function isBackgroundWorkTarget(target: string): boolean {
  return /\b(?:background|cron|scheduled|schedule|scheduler|worker|queue|processor)\b/i.test(
    target,
  );
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
