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

import { ROUTE_CATALOG } from './intentRouterCatalog.js';
import type { RouteResult } from './intentRouterResult.js';
import { routeIntentWithCatalog } from './intentRouterResolution.js';

export { ROUTE_CATALOG };
export type { RouteEntry } from './intentRouterCatalog.js';
export type { RouteConfidence, RouteMatch, RouteResult } from './intentRouterResult.js';

/**
 * Map a stated intent to the best-matching projscan tool(s). With no intent,
 * returns the full catalog grouped by category. Ranking is keyword overlap;
 * ties keep catalog order (deterministic).
 */
export function routeIntent(intent: string | undefined): RouteResult {
  return routeIntentWithCatalog(intent, ROUTE_CATALOG);
}
