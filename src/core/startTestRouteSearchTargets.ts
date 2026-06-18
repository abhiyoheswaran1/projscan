import { unwrapTarget } from './startIntentTargetText.js';

export function searchQueryFromTestAndRouteLookups(trimmed: string): string | undefined {
  const testCoverageLookup = trimmed.match(
    /\b(?:which|what|find|locate|search(?:\s+for)?|where\s+(?:are|is))\s+(?:the\s+)?(?:tests?|specs?)\s+(?:that\s+)?(?:cover|covers|covering)\s+(.+?)\s*[?!.]*$/i,
  );
  if (testCoverageLookup?.[1]) return `tests for ${unwrapTarget(testCoverageLookup[1].trim())}`;
  const testLocation = trimmed.match(
    /\b(?:where\s+(?:are|is)\s+|find\s+|locate\s+|search\s+(?:for\s+)?|lookup\s+)?(?:the\s+)?(?:tests?|specs?)\s+(?:for|of)\s+(.+?)\s*[?!.]*$/i,
  );
  if (testLocation?.[1]) return `tests for ${unwrapTarget(testLocation[1].trim())}`;
  const routePath = trimmed.match(
    /(?:^|\s)((?:(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+)?\/[A-Za-z0-9_./:{}-]+)/i,
  );
  if (
    routePath?.[1] &&
    /\b(?:handler|handles?|handled|route|routes|endpoint|endpoints|where|find|locate|search)\b/i.test(
      trimmed,
    )
  ) {
    return routePath[1].trim();
  }
  const codeHandler = trimmed.match(
    /\b(?:what|which)\s+(?:code|file|files)?\s*(?:handles?|contains|loads?|parses?|configures?|creates?)\s+(.+?)\s*[?!.]*$/i,
  );
  if (codeHandler?.[1]) return unwrapTarget(codeHandler[1].trim());
  const featureFlags = trimmed.match(
    /\b(?:which|what|where|find|locate|search(?:\s+for)?|lookup)\s+(?:are\s+|is\s+|do\s+|does\s+)?(?:the\s+)?((?:feature\s+)?flags?)\s+(?:exist|exists|configured|loaded|defined)?\s*[?!.]*$/i,
  );
  if (featureFlags?.[1])
    return featureFlags[1].toLowerCase().includes('feature') ? 'feature flags' : 'flags';
  return migrationSearchQuery(trimmed);
}

function migrationSearchQuery(trimmed: string): string | undefined {
  const migrationLookup = trimmed.match(
    /\b(?:where\s+(?:are|is)|which|what|find|locate|search(?:\s+for)?|lookup|show)\s+(?:me\s+)?(?:the\s+)?((?:database\s+|prisma\s+)?migrations?|(?:database\s+)?migration\s+files?)\s*(?:exist|exists|ran|located|live)?\s*[?!.]*$/i,
  );
  if (migrationLookup?.[1]) {
    const target = migrationLookup[1].trim().toLowerCase();
    if (target.includes('prisma')) return 'Prisma migrations';
    if (target.includes('database'))
      return target.includes('file') ? 'database migration files' : 'database migrations';
    return target.includes('file') ? 'migration files' : 'migrations';
  }
  return undefined;
}
