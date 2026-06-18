import type { RouteEntry } from './intentRouterCatalog.js';
import {
  buildCatalogRouteResult,
  buildScoredRouteResult,
  type RouteResult,
} from './intentRouterResult.js';
import { scoreRouteCatalog } from './intentRouterScoring.js';
import { tokenizeIntent } from './intentRouterTokens.js';

export function routeIntentWithCatalog(
  intent: string | undefined,
  catalog: readonly RouteEntry[],
): RouteResult {
  if (!intent || intent.trim() === '') {
    return buildCatalogRouteResult(catalog);
  }

  const scored = scoreRouteCatalog(intent, catalog, new Set(tokenizeIntent(intent)));
  return buildScoredRouteResult(intent, scored);
}
