import type { RouteEntry } from './intentRouterCatalog.js';
import { routeScore, type ScoredRoute } from './intentRouterScoring.js';

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

export function buildCatalogRouteResult(entries: readonly RouteEntry[]): RouteResult {
  const grouped = [...entries].sort((a, b) => a.category.localeCompare(b.category));
  return {
    intent: null,
    matched: grouped.length > 0,
    matches: grouped.map((entry, index) => routeMatch(entry, index + 1, [])),
  };
}

export function buildScoredRouteResult(intent: string, scored: readonly ScoredRoute[]): RouteResult {
  return {
    intent,
    matched: scored.length > 0,
    matches: scored.map((s, index) => routeMatch(s.entry, index + 1, s.matchedKeywords)),
  };
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

function routeConfidence(score: number): RouteConfidence {
  if (score >= 2) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}
