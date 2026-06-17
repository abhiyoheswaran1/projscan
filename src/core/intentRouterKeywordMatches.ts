import { routeKeywordRejectedByEarlyGuards } from './intentRouterKeywordEarlyGuards.js';
import type { KeywordMatchRouteEntry } from './intentRouterKeywordContext.js';
import { routeKeywordSearchGuardDecision } from './intentRouterKeywordSearchGuards.js';
import { routeKeywordTargetGuardDecision } from './intentRouterKeywordTargetGuards.js';
import { routeKeywordToolGuardDecision } from './intentRouterKeywordToolGuards.js';

export type { KeywordMatchRouteEntry };

export function routeKeywordMatches(
  entry: KeywordMatchRouteEntry,
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
  hasPackageRemoval: boolean,
  hasPackageChange: boolean,
  hasEnvVar: boolean,
  hasQuotedText: boolean,
): boolean {
  if (!tokens.has(keyword)) return false;
  const context = {
    entry,
    keyword,
    tokens,
    hasFilePath,
    hasPackageRemoval,
    hasPackageChange,
    hasEnvVar,
    hasQuotedText,
  };
  if (routeKeywordRejectedByEarlyGuards(context)) return false;
  const targetGuardDecision = routeKeywordTargetGuardDecision(context);
  if (targetGuardDecision !== undefined) return targetGuardDecision;
  const searchGuardDecision = routeKeywordSearchGuardDecision(context);
  if (searchGuardDecision !== undefined) return searchGuardDecision;
  const toolGuardDecision = routeKeywordToolGuardDecision(context);
  if (toolGuardDecision !== undefined) return toolGuardDecision;
  return true;
}
