import type { GraphQueryDirection } from './graphQuery.js';
import { isPlaceholder, quoteShellArg } from './startShellArgs.js';
import { extractFileTarget } from './startFileTargets.js';
import { isPackageNameTarget, normalizePackageName } from './startPackageTargets.js';
import { extractSymbolTarget } from './startSymbolTargets.js';
import { isGenericReferenceTarget, unwrapTarget } from './startIntentTargetText.js';
import { extractApiContractQuery } from './startIntentApiContractQueries.js';
import { extractAuthorizationQuery } from './startIntentAuthorizationQueries.js';
import { extractBackgroundWorkQuery } from './startIntentBackgroundWorkQueries.js';
import { extractCommunicationArtifactQuery } from './startIntentCommunicationArtifactQueries.js';
import { extractDataAccessQuery } from './startIntentDataAccessQueries.js';
import { extractDataContractQuery } from './startIntentDataContractQueries.js';
import { extractDomainWorkflowQuery } from './startIntentDomainWorkflowQueries.js';
import { extractFrontendPageRouteQuery } from './startIntentFrontendPageRouteQueries.js';
import { extractInfraArtifactQuery } from './startIntentInfraArtifactQueries.js';
import { extractIntegrationQuery } from './startIntentIntegrationQueries.js';
import { extractNavigationLayoutQuery } from './startIntentNavigationLayoutQueries.js';
import { extractObservabilityQuery } from './startIntentObservabilityQueries.js';
import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';
import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';
import { extractStyleSystemQuery } from './startIntentStyleSystemQueries.js';
import { extractTestDataQuery } from './startIntentTestDataQueries.js';
import { extractToolingConfigQuery } from './startIntentToolingConfigQueries.js';
import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';

export type StartGraphQuery = {
  direction: GraphQueryDirection;
  file?: string;
  symbol?: string;
  limit?: number;
};

type QueryExtractor = (intent: string) => string | undefined;

export { extractFileTarget, isFilePathTarget } from './startFileTargets.js';
export { extractReportScopeTarget } from './startReportScopeTargets.js';
export { extractAuditPackageTarget, extractPackageTarget } from './startPackageTargets.js';
export { extractIssueIdTarget } from './startIssueTargets.js';
export { isExactSymbolTarget } from './startSymbolTargets.js';
export { escapeDoubleQuoted, isPlaceholder, quoteShellArg, quoteShellArgOrPlaceholder } from './startShellArgs.js';

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

function extractQuotedTextTarget(intent: string): string | undefined {
  const quoted = intent.match(/(["'`])(.{2,200}?)\1/);
  const target = quoted?.[2]?.trim();
  return target && !isGenericReferenceTarget(target) ? target : undefined;
}
