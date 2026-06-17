/**
 * Intent router (4.x agent-ergonomics, epic 4).
 *
 * projscan exposes 40+ MCP tools. An agent shouldn't have to reason over all of
 * them every turn — it should be able to state a goal and get pointed at the one
 * right tool. `routeIntent` does exactly that: a deterministic, curated map from
 * common agent intents to the tool + exact call. No LLM (projscan never embeds
 * inference); ranking is keyword overlap against a hand-curated catalog.
 *
 * This is the additive, non-breaking half of the epic — a discovery entry point.
 * Actually shrinking the advertised tool surface (hiding the long tail behind
 * this router) is a breaking change reserved for 4.0.
 */

import { keywordWeight } from './intentRouterKeywordWeights.js';
import { ROUTE_CATALOG, type RouteEntry } from './intentRouterCatalog.js';
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

export { ROUTE_CATALOG, type RouteEntry } from './intentRouterCatalog.js';

export type RouteConfidence = 'high' | 'medium' | 'low';

export interface RouteMatch extends RouteEntry {
  score: number;
  rank: number;
  confidence: RouteConfidence;
  matchedKeywords: string[];
}

export interface RouteResult {
  intent: string | null;
  matched: boolean;
  matches: RouteMatch[];
}

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

interface ScoredRoute {
  entry: RouteEntry;
  score: number;
  matchedKeywords: string[];
  index: number;
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'i',
  'to',
  'my',
  'is',
  'it',
  'of',
  'in',
  'on',
  'and',
  'or',
  'for',
  'this',
  'that',
  'how',
  'what',
  'me',
  'we',
  'with',
  'can',
  'should',
  'if',
  'be',
  'am',
  'are',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Map a stated intent to the best-matching projscan tool(s). With no intent,
 * returns the full catalog grouped by category. Ranking is keyword overlap;
 * ties keep catalog order (deterministic).
 */
export function routeIntent(intent: string | undefined): RouteResult {
  if (!intent || intent.trim() === '') {
    const grouped = [...ROUTE_CATALOG].sort((a, b) => a.category.localeCompare(b.category));
    return {
      intent: null,
      matched: grouped.length > 0,
      matches: grouped.map((entry, index) => routeMatch(entry, index + 1, [])),
    };
  }

  const signals = intentSignals(intent);
  const scored = ROUTE_CATALOG.map((entry, index) => scoreRouteEntry(entry, index, signals))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return {
    intent,
    matched: scored.length > 0,
    matches: scored.map((s, index) => routeMatch(s.entry, index + 1, s.matchedKeywords)),
  };
}

function intentSignals(intent: string): IntentSignals {
  const tokens = new Set(tokenize(intent));
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

function routeMatch(entry: RouteEntry, rank: number, matchedKeywords: string[]): RouteMatch {
  const score = routeScore(entry, matchedKeywords);
  return {
    ...entry,
    score,
    rank,
    confidence: routeConfidence(score),
    matchedKeywords,
  };
}

function routeScore(entry: RouteEntry, matchedKeywords: string[]): number {
  return matchedKeywords.reduce((total, keyword) => total + keywordWeight(entry, keyword), 0);
}

function routeConfidence(score: number): RouteConfidence {
  if (score >= 2) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}
