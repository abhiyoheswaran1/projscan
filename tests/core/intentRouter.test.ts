import { describe, it, expect } from 'vitest';
import { routeIntent, ROUTE_CATALOG } from '../../src/core/intentRouter.js';

describe('routeIntent', () => {
  it('routes "what breaks if I rename a function" to impact', () => {
    const result = routeIntent('what breaks if I rename a function');
    expect(result.matches[0].tool).toBe('projscan_impact');
  });

  it('routes "review my PR" to review', () => {
    const result = routeIntent('review my pull request');
    expect(result.matches[0].tool).toBe('projscan_review');
  });

  it('routes coordination intents to the swarm tools', () => {
    const result = routeIntent('coordinate parallel agents working the same repo');
    const tools = result.matches.map((m) => m.tool);
    expect(tools).toContain('projscan_collision');
  });

  it('routes "is it safe to commit" to preflight', () => {
    const result = routeIntent('is it safe to commit this change');
    expect(result.matches[0].tool).toBe('projscan_preflight');
  });

  it('returns the full grouped catalog when no intent is given', () => {
    const result = routeIntent(undefined);
    expect(result.intent).toBeNull();
    expect(result.matches.length).toBe(ROUTE_CATALOG.length);
    // grouped by category, every catalog entry present
    const tools = new Set(result.matches.map((m) => m.tool));
    expect(tools.has('projscan_understand')).toBe(true);
    expect(tools.has('projscan_collision')).toBe(true);
  });

  it('reports no match for an unrelated intent', () => {
    const result = routeIntent('brew a cup of tea');
    expect(result.matches).toEqual([]);
    expect(result.matched).toBe(false);
  });

  it('every catalog entry names a real tool and a runnable example', () => {
    for (const entry of ROUTE_CATALOG) {
      expect(entry.tool).toMatch(/^projscan_/);
      expect(entry.cli).toMatch(/^projscan /);
      expect(entry.example.length).toBeGreaterThan(0);
      expect(entry.keywords.length).toBeGreaterThan(0);
    }
  });
});
