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

import { ROUTE_CATALOG, type RouteEntry } from './intentRouterCatalog.js';
import { routeScore, scoreRouteCatalog } from './intentRouterScoring.js';
import { tokenizeIntent } from './intentRouterTokens.js';

export { ROUTE_CATALOG };
export type { RouteEntry };

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

  const scored = scoreRouteCatalog(intent, ROUTE_CATALOG, new Set(tokenizeIntent(intent)));

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
