import { keywordWeight } from './intentRouterKeywordWeights.js';
import type { RouteEntry } from './intentRouterCatalog.js';
import { routeKeywordMatches } from './intentRouterKeywordMatches.js';
import {
  hasProhibitedReleaseWorkflowAction,
  hasProhibitedVersionBumpAction,
  prohibitedWorkflowKeywordMatches,
} from './intentRouterReleaseSignals.js';
import {
  hasEnvVarTarget,
  hasFilePathTarget,
  hasPackageChangeTarget,
  hasPackageRemovalTarget,
  hasQuotedTextTarget,
} from './intentRouterTargetSignals.js';

interface IntentSignals {
  tokens: Set<string>;
  hasFilePath: boolean;
  hasPackageRemoval: boolean;
  hasPackageChange: boolean;
  hasEnvVar: boolean;
  hasQuotedText: boolean;
  hasProhibitedReleaseAction: boolean;
  hasProhibitedVersionBump: boolean;
}

export interface ScoredRoute {
  entry: RouteEntry;
  score: number;
  matchedKeywords: string[];
  index: number;
}

export function scoreRouteCatalog(
  intent: string,
  entries: readonly RouteEntry[],
  tokens: Set<string>,
): ScoredRoute[] {
  const signals = intentSignals(intent, tokens);
  return entries
    .map((entry, index) => scoreRouteEntry(entry, index, signals))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

export function routeScore(entry: RouteEntry, matchedKeywords: string[]): number {
  return matchedKeywords.reduce((total, keyword) => total + keywordWeight(entry, keyword), 0);
}

function intentSignals(intent: string, tokens: Set<string>): IntentSignals {
  const hasFilePath = hasFilePathTarget(intent);

  return {
    tokens,
    hasFilePath,
    hasPackageRemoval: !hasFilePath && hasPackageRemovalTarget(intent),
    hasPackageChange: !hasFilePath && hasPackageChangeTarget(intent),
    hasEnvVar: hasEnvVarTarget(intent),
    hasQuotedText: hasQuotedTextTarget(intent),
    hasProhibitedReleaseAction: hasProhibitedReleaseWorkflowAction(intent),
    hasProhibitedVersionBump: hasProhibitedVersionBumpAction(intent),
  };
}

function scoreRouteEntry(entry: RouteEntry, index: number, signals: IntentSignals): ScoredRoute {
  const matchedKeywords = matchedEntryKeywords(entry, signals);
  return { entry, score: routeScore(entry, matchedKeywords), matchedKeywords, index };
}

function matchedEntryKeywords(entry: RouteEntry, signals: IntentSignals): string[] {
  return entry.keywords
    .filter((keyword) => workflowKeywordAllowed(entry, keyword, signals))
    .filter((keyword) =>
      routeKeywordMatches(
        entry,
        keyword,
        signals.tokens,
        signals.hasFilePath,
        signals.hasPackageRemoval,
        signals.hasPackageChange,
        signals.hasEnvVar,
        signals.hasQuotedText,
      ),
    );
}

function workflowKeywordAllowed(
  entry: RouteEntry,
  keyword: string,
  signals: IntentSignals,
): boolean {
  return !prohibitedWorkflowKeywordMatches(
    entry,
    keyword,
    signals.hasProhibitedReleaseAction,
    signals.hasProhibitedVersionBump,
  );
}
