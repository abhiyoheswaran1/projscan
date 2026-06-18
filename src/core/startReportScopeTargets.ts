const REPORT_SCOPE_DIRECTORY_TARGETS = new Set([
  'app',
  'apps',
  'docs',
  'examples',
  'lib',
  'libs',
  'packages',
  'scripts',
  'src',
  'test',
  'tests',
]);

export function extractReportScopeTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const explicitScopes = extractReportScopeTargets(compactIntent);
  if (explicitScopes.length > 0) return explicitScopes.join(',');

  const scopedDirectory = compactIntent.match(
    /\b(?:for|under|inside|within|from|scope(?:d)?\s+to|scope)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9_-]{1,63})(?=\s|$)/i,
  );
  const candidate = scopedDirectory?.[1];
  return candidate && isReportScopeDirectoryTarget(candidate) ? candidate : undefined;
}

function extractReportScopeTargets(intent: string): string[] {
  const candidates = [
    ...Array.from(intent.matchAll(/[`'"]([^`'"]+)[`'"]/g), (match) => unwrapTarget(match[1])),
    ...Array.from(
      intent.matchAll(
        /(?:^|\s)([A-Za-z][A-Za-z0-9_-]*(?:\/[A-Za-z0-9_.:@-]+)+|[A-Za-z][A-Za-z0-9_-]*\.[A-Za-z0-9]{1,12})(?=\s|$|,)/g,
      ),
      (match) => unwrapTarget(match[1]),
    ),
  ];
  const seen = new Set<string>();
  const scopes: string[] = [];
  for (const candidate of candidates) {
    if (!isReportScopePathTarget(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    scopes.push(candidate);
  }
  return scopes;
}

function isReportScopePathTarget(candidate: string): boolean {
  if (isFilePathTarget(candidate)) return true;
  const topLevel = candidate.split('/')[0];
  return topLevel ? isReportScopeDirectoryTarget(topLevel) : false;
}

function isReportScopeDirectoryTarget(candidate: string): boolean {
  return REPORT_SCOPE_DIRECTORY_TARGETS.has(candidate.toLowerCase());
}

function isFilePathTarget(target: string): boolean {
  return (
    (target.includes('/') || target.startsWith('.') || /\.[A-Za-z0-9]{1,12}$/.test(target)) &&
    !/\s/.test(target)
  );
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
