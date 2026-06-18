import type { GraphQueryDirection } from './graphQuery.js';
import { extractFileTarget } from './startFileTargets.js';
import { isPackageNameTarget, normalizePackageName } from './startPackageTargets.js';
import { isPlaceholder, quoteShellArg } from './startShellArgs.js';
import { extractSymbolTarget } from './startSymbolTargets.js';

export type StartGraphQuery = {
  direction: GraphQueryDirection;
  file?: string;
  symbol?: string;
  limit?: number;
};

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
