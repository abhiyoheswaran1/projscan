import { describe, expect, it } from 'vitest';
import { routeIntent, ROUTE_CATALOG } from '../../src/core/intentRouter.js';

describe('routeIntent catalog routing', () => {
  it('routes bundle-size and package-bloat questions to dependency inventory', () => {
    const bundle = routeIntent('why is the bundle so large');
    expect(bundle.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['bundle', 'large']),
      }),
    );
    expect(bundle.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['why'],
      }),
    );

    const reduce = routeIntent('reduce bundle size');
    expect(reduce.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['bundle', 'size']),
      }),
    );

    const bloat = routeIntent('find package bloat');
    expect(bloat.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['package', 'bloat']),
      }),
    );
    expect(bloat.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['package'],
      }),
    );
  });

  it('routes circular dependency and tight-coupling questions to coupling analysis', () => {
    const circular = routeIntent('show circular dependencies');
    expect(circular.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Architecture',
        tool: 'projscan_coupling',
        cli: 'projscan coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['circular', 'dependencies']),
      }),
    );
    expect(
      circular.matches.find((match) => match.tool === 'projscan_dependencies'),
    ).toBeUndefined();

    const cycles = routeIntent('find dependency cycles');
    expect(cycles.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['dependency', 'cycles']),
      }),
    );
    expect(cycles.matches.find((match) => match.tool === 'projscan_dependencies')).toBeUndefined();

    const tight = routeIntent('what modules are tightly coupled');
    expect(tight.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['modules', 'coupled']),
      }),
    );
  });

  it('returns the full grouped catalog when no intent is given', () => {
    const result = routeIntent(undefined);
    expect(result.intent).toBeNull();
    expect(result.matches.length).toBe(ROUTE_CATALOG.length);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        confidence: 'low',
        rank: 1,
        score: 0,
        matchedKeywords: [],
      }),
    );
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
