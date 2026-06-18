import type { GraphQueryDirection } from './graphQuery.js';
import { extractDataAccessQuery } from './startIntentDataAccessQueries.js';
import { extractDataContractQuery } from './startIntentDataContractQueries.js';
import { extractIntegrationQuery } from './startIntentIntegrationQueries.js';
import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';
import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';
import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';

export type StartGraphQuery = {
  direction: GraphQueryDirection;
  file?: string;
  symbol?: string;
  limit?: number;
};

type QueryExtractor = (intent: string) => string | undefined;

export { extractReportScopeTarget } from './startReportScopeTargets.js';

function firstQuery(intent: string, extractors: readonly QueryExtractor[]): string | undefined {
  for (const extract of extractors) {
    const query = extract(intent);
    if (query) return query;
  }
  return undefined;
}

export function extractSearchQuery(intent: string): string {
  const trimmed = intent.trim();
  return (
    searchQueryFromHighPrioritySignals(trimmed) ??
    searchQueryFromDomainSignals(trimmed) ??
    searchQueryFromTestAndRouteLookups(trimmed) ??
    searchQueryFromGeneratedAndConfig(trimmed) ??
    searchQueryFromOwnership(trimmed) ??
    searchQueryFromImplementation(trimmed) ??
    unwrapTarget(
      (trimmed.match(/\b(?:search|find|locate|lookup)\s+(?:for\s+)?(.+)$/i)?.[1] ?? trimmed).trim(),
    )
  );
}

function searchQueryFromHighPrioritySignals(trimmed: string): string | undefined {
  const file = extractFileTarget(trimmed);
  if (file && /\b(?:where|find|locate|search)\b/i.test(trimmed) && /\btests?\b/i.test(trimmed)) {
    return `tests for ${file}`;
  }
  const envVar = extractEnvVarTarget(trimmed);
  if (envVar && /\b(?:where|find|locate|search|lookup|used|referenced|process)\b/i.test(trimmed)) {
    return envVar;
  }
  const envControl = trimmed.match(
    /\b(?:which|what|where|find|locate|search(?:\s+for)?|lookup)\s+(?:env(?:ironment)?\s+)?(?:var|vars|variable|variables)\s+(?:controls?|configures?|sets?|for)\s+(.+?)\s*[?!.]*$/i,
  );
  if (envControl?.[1]) return `${unwrapTarget(envControl[1].trim())} env var`;
  const quotedDebugText = extractQuotedTextTarget(trimmed);
  if (
    quotedDebugText &&
    /\b(?:error|errors|message|messages|throws?|thrown|logs?|logged|logging)\b/i.test(trimmed)
  ) {
    return quotedDebugText;
  }
  return undefined;
}

function searchQueryFromDomainSignals(trimmed: string): string | undefined {
  return firstQuery(trimmed, [
    extractObservabilityQuery,
    extractBackgroundWorkQuery,
    extractTestDataQuery,
    extractAuthorizationQuery,
    extractReliabilityQuery,
    extractDataContractQuery,
    extractUiInteractionQuery,
    extractStyleSystemQuery,
    extractNavigationLayoutQuery,
    extractFrontendPageRouteQuery,
    extractStateManagementQuery,
    extractDataAccessQuery,
    extractIntegrationQuery,
    extractApiContractQuery,
    extractInfraArtifactQuery,
    extractCommunicationArtifactQuery,
    extractDomainWorkflowQuery,
  ]);
}

function searchQueryFromTestAndRouteLookups(trimmed: string): string | undefined {
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

function searchQueryFromGeneratedAndConfig(trimmed: string): string | undefined {
  const generatedLookup = trimmed.match(
    /\b(?:show|find|locate|search(?:\s+for)?|where\s+(?:are|is)|which|what|is)\s+(?:me\s+)?(?:this\s+)?(?:the\s+)?(.+?)\s*[?!.]*$/i,
  );
  if (generatedLookup?.[1] && /\bgenerated\b/i.test(generatedLookup[1])) {
    if (/\bfiles?\b/i.test(generatedLookup[1])) return 'generated files';
    if (/\bcode\b/i.test(generatedLookup[1])) return 'generated code';
  }
  const toolingConfig = extractToolingConfigQuery(trimmed);
  if (toolingConfig) return toolingConfig;
  const configDefinitionLookup = trimmed.match(
    /\bwhich\s+(?:config(?:uration)?\s+files?|files?)\s+(?:defines?|contains|sets?|configures?)\s+(.+?)\s*[?!.]*$/i,
  );
  if (configDefinitionLookup?.[1] && /\bconfig(?:uration)?\b/i.test(trimmed))
    return `${unwrapTarget(configDefinitionLookup[1].trim())} config`;
  const configLookup = trimmed.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup|show)\s+(?:the\s+)?(.+?\bconfig(?:uration)?(?:\s+files?)?)\s*[?!.]*$/i,
  );
  if (configLookup?.[1]) return unwrapTarget(configLookup[1].trim());
  return undefined;
}

function searchQueryFromOwnership(trimmed: string): string | undefined {
  const ownership = trimmed.match(/\b(?:who|which\s+team)\s+owns?\s+(.+?)\s*[?!.]*$/i);
  if (ownership?.[1]) return unwrapTarget(ownership[1].trim());
  const ownershipHelp = trimmed.match(
    /\bwho\s+(?:should\s+i\s+ask|can\s+help|knows|is\s+(?:the\s+)?(?:expert|contact))\s*(?:about|with|for)?\s+(.+?)\s*[?!.]*$/i,
  );
  if (ownershipHelp?.[1]) return unwrapTarget(ownershipHelp[1].trim());
  const expertLookup = trimmed.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:an?\s+)?(?:expert|experts|contact|contacts)\s+(?:for|on|about|with)\s+(.+?)\s*[?!.]*$/i,
  );
  if (expertLookup?.[1]) return unwrapTarget(expertLookup[1].trim());
  const codeOwners = trimmed.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup)\s+(?:code\s+)?owners?\s+(?:for|of)\s+(.+?)\s*[?!.]*$/i,
  );
  if (codeOwners?.[1]) return unwrapTarget(codeOwners[1].trim());
  return undefined;
}

function searchQueryFromImplementation(trimmed: string): string | undefined {
  const whereImplemented = trimmed.match(
    /\bwhere\s+(?:is|are|do|does|we)?\s*(.+?)\s+(?:implemented|handled|configured|created|defined|loaded|parsed|documented)\b/i,
  );
  if (whereImplemented?.[1]) return unwrapTarget(whereImplemented[1].trim());
  return undefined;
}

export function extractImpactTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const usageMatch = compactIntent.match(
    /\bwhere\s+(?:is|are)\s+[`'"]?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)[`'"]?\s+(?:used|referenced|called)\b/i,
  );
  if (usageMatch?.[1] && !isGenericReferenceTarget(usageMatch[1])) return usageMatch[1];

  const match = compactIntent.match(
    /\b(?:rename|change|modify|delete|remove)\s+(?:the\s+|a\s+|an\s+)?(.+)$/i,
  );
  const target = unwrapTarget((match?.[1] ?? '').trim());
  if (target.length === 0) return undefined;
  const normalized = target
    .replace(/\s+(?:in|from|inside)\s+(?:this\s+)?(?:repo|repository|codebase)$/i, '')
    .trim();
  if (isGenericReferenceTarget(normalized)) return undefined;
  return normalized;
}

function isGenericReferenceTarget(target: string): boolean {
  return /^(?:it|this|that|thing|symbol|function|method|file|change|changes|break|breaks|breaking|safely|safe|carefully)$/i.test(
    target,
  );
}

export function extractFileTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([^`'"]+\.[A-Za-z0-9]{1,12})[`'"]/);
  if (wrapped?.[1] && isFilePathTarget(wrapped[1])) return wrapped[1];

  const pathMatch = compactIntent.match(/(?:^|\s)([A-Za-z0-9_./:@-]+\.[A-Za-z0-9]{1,12})(?:\s|$)/);
  if (pathMatch?.[1] && isFilePathTarget(pathMatch[1])) return unwrapTarget(pathMatch[1]);

  const slashPathMatch = compactIntent.match(
    /(?:^|\s)([A-Za-z0-9_./:@-]+\/[A-Za-z0-9_./:@-]+)(?:\s|$)/,
  );
  if (slashPathMatch?.[1] && isFilePathTarget(slashPathMatch[1]))
    return unwrapTarget(slashPathMatch[1]);

  return undefined;
}

function extractEnvVarTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const processMatch = compactIntent.match(/\bprocess\.env\.[A-Za-z_][A-Za-z0-9_]*\b/);
  if (processMatch?.[0]) return processMatch[0];
  const envMatch = compactIntent.match(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/);
  return envMatch?.[1];
}

export function extractClaimTarget(intent: string): string | undefined {
  return extractFileTarget(intent) ?? extractSymbolTarget(intent);
}

export function extractClaimAgent(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const match = compactIntent.match(/\b(?:as|for|agent)\s+([A-Za-z0-9_.:@-]{2,64})\b/i);
  const candidate = match?.[1];
  if (!candidate || /^(?:me|myself|us|team|agent|owner)$/i.test(candidate)) return undefined;
  return candidate;
}

export function extractIssueIdTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"]([^`'"]*[A-Za-z][^`'"]*-[^`'"]+)[`'"]/);
  if (wrapped?.[1] && isIssueIdTarget(wrapped[1])) return wrapped[1];

  const labeled = compactIntent.match(
    /\b(?:issue(?:\s+id)?|id|rule)\s+(?:is\s+|named\s+)?([A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+)\b/i,
  );
  if (labeled?.[1] && isIssueIdTarget(labeled[1])) return labeled[1];

  const issueLike = compactIntent.match(
    /\b([A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+)\b/,
  );
  if (issueLike?.[1] && isIssueIdTarget(issueLike[1])) return issueLike[1];

  return undefined;
}

export function extractPackageTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const wrapped = compactIntent.match(/[`'"](@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)[`'"]/);
  if (wrapped?.[1] && isPackageNameTarget(wrapped[1])) return normalizePackageName(wrapped[1]);

  const actionMatch = compactIntent.match(
    /\b(?:bump|upgrade|update|remove|drop|uninstall)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  if (actionMatch?.[1] && isPackageNameTarget(actionMatch[1]))
    return normalizePackageName(actionMatch[1]);

  const removalSubject = compactIntent.match(
    /\b(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:safe\s+to\s+)?(?:remove|drop|uninstall)\b/i,
  );
  if (removalSubject?.[1] && isPackageNameTarget(removalSubject[1]))
    return normalizePackageName(removalSubject[1]);

  const labeled = compactIntent.match(
    /\b(?:package|dependency)\s+(?:named\s+|called\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  if (labeled?.[1] && isPackageNameTarget(labeled[1])) return normalizePackageName(labeled[1]);

  return undefined;
}

export function extractAuditPackageTarget(intent: string): string | undefined {
  const packageName = extractPackageTarget(intent);
  if (packageName) return packageName;

  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const subject = compactIntent.match(
    /\b(?:does|is|can)\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:have|has|contain|contains|affected|vulnerable|secure|safe)\b/i,
  );
  if (subject?.[1] && isPackageNameTarget(subject[1])) return normalizePackageName(subject[1]);

  const command = compactIntent.match(
    /\b(?:audit|check|scan)\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:for\s+)?(?:cve|cves|vulnerabilities|vulnerability|security)\b/i,
  );
  if (command?.[1] && isPackageNameTarget(command[1])) return normalizePackageName(command[1]);

  return undefined;
}

export function graphQueryFromIntent(intent: string): StartGraphQuery | undefined {
  const file = extractFileTarget(intent);
  const packageName = extractGraphPackageTarget(intent);
  const symbol = extractSymbolTarget(intent);
  const direction = graphDirectionFromIntent(intent);
  return direction ? graphQueryForDirection(direction, { file, packageName, symbol }) : undefined;
}

function graphQueryForDirection(
  direction: GraphQueryDirection,
  target: { file?: string; packageName?: string; symbol?: string },
): StartGraphQuery {
  if (['imports', 'exports', 'importers'].includes(direction) && target.file)
    return { direction, file: target.file };
  if (direction === 'package_importers' && target.packageName)
    return { direction, symbol: target.packageName };
  if (['symbol_defs', 'package_importers'].includes(direction) && target.symbol)
    return { direction, symbol: target.symbol };
  return { direction };
}

function graphDirectionFromIntent(intent: string): GraphQueryDirection | undefined {
  const text = intent.toLowerCase();
  if (!extractFileTarget(intent) && packageImporterGraphIntent(text)) return 'package_importers';
  return GRAPH_DIRECTION_RULES.find((rule) => rule.pattern.test(text))?.direction;
}

const GRAPH_DIRECTION_RULES: Array<{ pattern: RegExp; direction: GraphQueryDirection }> = [
  {
    pattern: /\b(?:who|what|which)\s+(?:files\s+)?imports?\b|\bimporters\b/,
    direction: 'importers',
  },
  { pattern: /\bexports?\b/, direction: 'exports' },
  { pattern: /\bimports?\b/, direction: 'imports' },
  { pattern: /\b(?:defined|definition|defines)\b/, direction: 'symbol_defs' },
];

function packageImporterGraphIntent(text: string): boolean {
  return [
    /\b(?:who|what|which)\s+uses?\b/,
    /\b(?:who|what|which)\s+depends?\s+on\b/,
    /\bwhy\b.*\b(?:depend\s+on|depends\s+on|installed)\b/,
    /\b(?:who|what|which)\s+(?:files\s+)?imports?\b/,
  ].some((pattern) => pattern.test(text));
}

export function graphQueryIsReady(query: StartGraphQuery): boolean {
  if (
    query.direction === 'imports' ||
    query.direction === 'exports' ||
    query.direction === 'importers'
  ) {
    return typeof query.file === 'string' && !isPlaceholder(query.file);
  }
  if (query.direction === 'symbol_defs' || query.direction === 'package_importers') {
    return typeof query.symbol === 'string' && !isPlaceholder(query.symbol);
  }
  return false;
}

export function semanticGraphCommand(query: StartGraphQuery): string {
  const parts = ['projscan semantic-graph', '--query', query.direction];
  if (query.file)
    parts.push('--file', isPlaceholder(query.file) ? query.file : quoteShellArg(query.file));
  if (query.symbol)
    parts.push(
      '--symbol',
      isPlaceholder(query.symbol) ? query.symbol : quoteShellArg(query.symbol),
    );
  if (typeof query.limit === 'number') parts.push('--limit', String(query.limit));
  parts.push('--format', 'json');
  return parts.join(' ');
}

function extractSymbolTarget(intent: string): string | undefined {
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

function extractGraphPackageTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const importMatch = compactIntent.match(
    /\b(?:who|what|which)\s+(?:files\s+)?imports?\s+(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\b/i,
  );
  if (importMatch?.[1] && isPackageNameTarget(importMatch[1]))
    return normalizePackageName(importMatch[1]);
  const useMatch = compactIntent.match(
    /\b(?:who|what|which)\s+uses?\s+(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\b/i,
  );
  if (useMatch?.[1] && isPackageNameTarget(useMatch[1])) return normalizePackageName(useMatch[1]);
  const dependsMatch = compactIntent.match(
    /\b(?:who|what|which|why(?:\s+do\s+we)?)\s+depends?\s+on\s+(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\b/i,
  );
  if (dependsMatch?.[1] && isPackageNameTarget(dependsMatch[1]))
    return normalizePackageName(dependsMatch[1]);
  const installedMatch = compactIntent.match(
    /\bwhy\s+is\s+(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+installed\b/i,
  );
  if (installedMatch?.[1] && isPackageNameTarget(installedMatch[1]))
    return normalizePackageName(installedMatch[1]);
  return undefined;
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

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}

function extractQuotedTextTarget(intent: string): string | undefined {
  const quoted = intent.match(/(["'`])(.{2,200}?)\1/);
  const target = quoted?.[2]?.trim();
  return target && !isGenericReferenceTarget(target) ? target : undefined;
}

function extractObservabilityQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  const logCheck = compactIntent.match(
    /\b(?:what|which)\s+logs?\s+should\s+i\s+check\s+(?:for|about|on)\s+(.+?)$/i,
  );
  if (logCheck?.[1]) return `${unwrapTarget(logCheck[1].trim())} logs`;

  const dashboard = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?dashboards?\s+(?:for|about|on)\s+(.+?)$/i,
  );
  if (dashboard?.[1]) return `${unwrapTarget(dashboard[1].trim())} dashboard`;

  const serviceInit = compactIntent.match(
    /\b(?:where\s+(?:do|does)\s+(?:we\s+)?(?:initialize|initialise|init)|find|locate|search(?:\s+for)?|lookup)\s+(Sentry|Datadog|Prometheus)\b/i,
  );
  if (serviceInit?.[1]) return serviceInit[1];

  const observabilityTarget =
    '(?:metrics?|prometheus\\s+metrics?|alerts?|analytics\\s+events?|events?|sentry\\s+errors?|datadog)';
  const lookup = compactIntent.match(
    new RegExp(
      `\\b(?:where\\s+(?:are|is)|which|what|find|locate|search(?:\\s+for)?|lookup)\\s+(?:the\\s+)?(.*?\\b${observabilityTarget}\\b)(?:\\s+(?:emitted|sent|configured|handled|initialized|initialised|created|defined))?$`,
      'i',
    ),
  );
  if (lookup?.[1] && isObservabilityTarget(lookup[1]))
    return unwrapTarget(lookup[1].trim()).replace(/^the\s+/i, '');
  return undefined;
}

function isObservabilityTarget(target: string): boolean {
  return /\b(?:metric|metrics|prometheus|alert|alerts|analytics|events?|sentry|datadog|dashboard|dashboards|logs?)\b/i.test(
    target,
  );
}

function extractBackgroundWorkQuery(intent: string): string | undefined {
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

function extractTestDataQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\bseeds?\s+data\b|\bdata\s+seeds?\b|\bseed\s+database\b|\bdatabase\s+seed\b/i.test(
      compactIntent,
    )
  ) {
    return 'seed data';
  }

  const storybook = compactIntent.match(
    /\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:storybook\s+)?stories\s+(?:for|of)\s+(.+?)$/i,
  );
  if (storybook?.[1]) return `${unwrapTarget(storybook[1].trim())} Storybook stories`;

  const storyRender = compactIntent.match(/\bwhich\s+stor(?:y|ies)\s+renders?\s+(.+?)$/i);
  if (storyRender?.[1]) return `${unwrapTarget(storyRender[1].trim())} story`;

  const fixtureLookup = compactIntent.match(
    /\b(?:where\s+(?:are|is)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(?:test\s+)?fixtures?\s+(?:for|of)\s+(.+?)$/i,
  );
  if (fixtureLookup?.[1]) return `${unwrapTarget(fixtureLookup[1].trim())} fixtures`;

  const mockUsage = compactIntent.match(
    /\bwhich\s+mocks?\s+(?:are\s+)?(?:used|configured)\s+(?:for|by|in)\s+(.+?)$/i,
  );
  if (mockUsage?.[1]) return `${unwrapTarget(mockUsage[1].trim())} mocks`;

  const factoryLookup = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:are|is))\s+(?:the\s+)?(?:factories?|factory)\s+(?:for|of)\s+(.+?)$/i,
  );
  if (factoryLookup?.[1]) return `${unwrapTarget(factoryLookup[1].trim())} factory`;
  return undefined;
}

function extractAuthorizationQuery(intent: string): string | undefined {
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

function extractStyleSystemQuery(intent: string): string | undefined {
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

function extractNavigationLayoutQuery(intent: string): string | undefined {
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

function extractFrontendPageRouteQuery(intent: string): string | undefined {
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

function extractApiContractQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return (
    fixedApiContractQuery(compactIntent) ??
    apiContractFromRules(compactIntent) ??
    graphQlSchemaQuery(compactIntent)
  );
}

function fixedApiContractQuery(compactIntent: string): string | undefined {
  if (/\bopenapi\b/i.test(compactIntent) && /\bspecs?\b/i.test(compactIntent))
    return 'OpenAPI spec';
  if (/\bswagger\b/i.test(compactIntent) && /\bdocs?\b/i.test(compactIntent)) return 'Swagger docs';
  return undefined;
}

const API_CONTRACT_RULES: Array<{ pattern: RegExp; suffix: string }> = [
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?trpc\s+routers?\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'tRPC router',
  },
  {
    pattern: /\b(?:which|what)\s+graphql\s+resolvers?\s+(?:handles?|for|of)\s+(.+?)$/i,
    suffix: 'GraphQL resolver',
  },
  { pattern: /\b(?:which|what)\s+(?:protobuf|proto)\s+defines?\s+(.+?)$/i, suffix: 'protobuf' },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?grpc\s+clients?\s+(?:for|of|on|in)\s+(.+?)$/i,
    suffix: 'gRPC client',
  },
];

function apiContractFromRules(compactIntent: string): string | undefined {
  for (const rule of API_CONTRACT_RULES) {
    const match = compactIntent.match(rule.pattern);
    if (match?.[1]) return `${unwrapTarget(match[1].trim())} ${rule.suffix}`;
  }
  return undefined;
}

function graphQlSchemaQuery(compactIntent: string): string | undefined {
  const graphqlSchema = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?graphql\s+schemas?\s*(?:for|of)?\s*(.*?)$/i,
  );
  if (graphqlSchema) {
    const target = unwrapTarget((graphqlSchema[1] ?? '').trim());
    return target ? `${target} GraphQL schema` : 'GraphQL schema';
  }
  return undefined;
}

function extractInfraArtifactQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return (
    fixedInfraArtifactQuery(compactIntent) ??
    dockerComposeQuery(compactIntent) ??
    infraArtifactFromRules(compactIntent)
  );
}

function fixedInfraArtifactQuery(compactIntent: string): string | undefined {
  if (/\bdockerfile\b/i.test(compactIntent)) return 'Dockerfile';
  if (/\b(?:kubernetes|k8s)\b/i.test(compactIntent) && /\bmanifests?\b/i.test(compactIntent))
    return 'Kubernetes manifests';
  return undefined;
}

function dockerComposeQuery(compactIntent: string): string | undefined {
  const dockerCompose = compactIntent.match(/\bdocker\s+compose(?:\s+(?:for|of)\s+(.+?))?$/i);
  if (dockerCompose) {
    const target = unwrapTarget((dockerCompose[1] ?? '').trim());
    return target ? `${target} docker compose` : 'docker compose';
  }
  return undefined;
}

const INFRA_ARTIFACT_RULES: Array<{
  pattern: RegExp;
  format: (match: RegExpMatchArray) => string | undefined;
}> = [
  {
    pattern:
      /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?helm\s+charts?\s+(?:for|of|on|in)\s+(.+?)$/i,
    format: (match) => (match[1] ? `${unwrapTarget(match[1].trim())} Helm chart` : undefined),
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?terraform\s+modules?\s+(?:for|of|on|in)\s+(.+?)$/i,
    format: (match) =>
      match[1] ? `${normalizeInfraTarget(match[1])} Terraform module` : undefined,
  },
  {
    pattern:
      /\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+github\s+workflows?\s+(?:deploys?|for|of|on|in)\s+(.+?)$/i,
    format: (match) => (match[1] ? `${unwrapTarget(match[1].trim())} GitHub workflow` : undefined),
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(vercel|netlify|railway|fly)\s+config(?:uration)?$/i,
    format: (match) => (match[1] ? `${normalizeInfraTarget(match[1])} config` : undefined),
  },
];

function infraArtifactFromRules(compactIntent: string): string | undefined {
  for (const rule of INFRA_ARTIFACT_RULES) {
    const match = compactIntent.match(rule.pattern);
    const query = match ? rule.format(match) : undefined;
    if (query) return query;
  }
  return undefined;
}

function extractToolingConfigQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  if (
    /\b(?:why|failing|failed|failure|failures|broken|error|errors|runtime|production|prod|outage|incident)\b/i.test(
      compactIntent,
    )
  ) {
    return undefined;
  }
  return toolingConfigFromRules(compactIntent) ?? lockfileQuery(compactIntent);
}

const TOOLING_CONFIG_RULES: Array<{ pattern: RegExp; query: string }> = [
  {
    pattern: /\btsconfig\b(?=.*\b(?:path|paths|alias|aliases)\b)/i,
    query: 'tsconfig path aliases',
  },
  { pattern: /\bvitest\b(?=.*\bconfig(?:uration)?\b)/i, query: 'Vitest config' },
  { pattern: /\bjest\b(?=.*\bconfig(?:uration)?\b)/i, query: 'Jest config' },
  { pattern: /\bbabel\b(?=.*\bconfig(?:uration)?\b)/i, query: 'Babel config' },
  { pattern: /\bwebpack\b(?=.*\bconfig(?:uration)?\b)/i, query: 'webpack config' },
  { pattern: /\bpackage\s+manager\b/i, query: 'package manager' },
  { pattern: /\bpnpm\s+workspaces?\b/i, query: 'pnpm workspace' },
  { pattern: /\byarn\s+workspaces?\b/i, query: 'yarn workspace' },
];

function toolingConfigFromRules(compactIntent: string): string | undefined {
  return TOOLING_CONFIG_RULES.find((rule) => rule.pattern.test(compactIntent))?.query;
}

function lockfileQuery(compactIntent: string): string | undefined {
  if (/\b(?:npm|pnpm|yarn)\s+lockfiles?\b/i.test(compactIntent)) {
    const manager = compactIntent.match(/\b(npm|pnpm|yarn)\b/i)?.[1]?.toLowerCase();
    return manager ? `${manager} lockfile` : 'lockfile';
  }
  return undefined;
}

function extractDomainWorkflowQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');

  if (/\bpassword\s+reset\b/i.test(compactIntent)) return 'password reset';

  const invite = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(.+?\binvite\s+flow)\b/i,
  );
  if (invite?.[1]) return unwrapTarget(invite[1].trim());

  if (/\bonboarding\s+flow\b/i.test(compactIntent)) return 'onboarding flow';

  const csvExport = compactIntent.match(
    /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?csv\s+exports?\s+(?:for|of)\s+(.+?)$/i,
  );
  if (csvExport?.[1]) return `${unwrapTarget(csvExport[1].trim())} CSV export`;

  if (
    /\baudit\s+logs?\s+entries\b/i.test(compactIntent) ||
    /\baudit\s+log\s+entries\b/i.test(compactIntent)
  )
    return 'audit log entries';

  const refund = compactIntent.match(
    /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?refund\s+handling\s+(?:for|of|on|in)\s+(.+?)$/i,
  );
  if (refund?.[1]) return `${unwrapTarget(refund[1].trim())} refund handling`;

  if (/\bsubscription\s+renewal\b/i.test(compactIntent)) return 'subscription renewal';

  return undefined;
}

function extractCommunicationArtifactQuery(intent: string): string | undefined {
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

function normalizeInfraTarget(value: string): string {
  return unwrapTarget(value.trim())
    .replace(/\bs3\b/gi, 'S3')
    .replace(/\bvercel\b/gi, 'Vercel')
    .replace(/\bnetlify\b/gi, 'Netlify')
    .replace(/\brailway\b/gi, 'Railway')
    .replace(/\bfly\b/gi, 'Fly');
}

export function isFilePathTarget(target: string): boolean {
  return (
    (target.includes('/') || target.startsWith('.') || /\.[A-Za-z0-9]{1,12}$/.test(target)) &&
    !/\s/.test(target)
  );
}

export function isExactSymbolTarget(target: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(target);
}

function isIssueIdTarget(target: string): boolean {
  return (
    /^[A-Za-z0-9_:@.-]*[A-Za-z][A-Za-z0-9_:@.-]*-[A-Za-z0-9_:@.-]+$/.test(target) &&
    !target.includes('/') &&
    target.toLowerCase() !== 'fix-suggest'
  );
}

function isPackageNameTarget(target: string): boolean {
  const lower = target.toLowerCase();
  if (
    [
      'package',
      'dependency',
      'dependencies',
      'version',
      'latest',
      'upgrade',
      'bump',
      'update',
      'for',
      'doc',
      'docs',
      'document',
      'documentation',
      'documented',
      'readme',
      'changelog',
      'example',
      'examples',
      'guide',
      'should',
      'could',
      'would',
      'can',
      'what',
      'which',
      'the',
      'this',
      'that',
      'it',
      'my',
    ].includes(lower)
  )
    return false;
  if (target.length === 0 || target.length > 214 || target !== target.trim()) return false;
  if (target.includes('..') || target.includes('\\')) return false;
  return /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(target);
}

function normalizePackageName(target: string): string {
  return target.toLowerCase();
}

export function isPlaceholder(value: string): boolean {
  return /^<[^<>]+>$/.test(value);
}

export function escapeDoubleQuoted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

export function quoteShellArg(value: string): string {
  return /^[A-Za-z0-9_./:@-]+$/.test(value) ? value : `"${escapeDoubleQuoted(value)}"`;
}

export function quoteShellArgOrPlaceholder(value: string): string {
  if (isPlaceholder(value)) return value;
  return quoteShellArg(value);
}
