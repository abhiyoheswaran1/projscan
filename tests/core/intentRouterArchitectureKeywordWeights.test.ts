import { describe, expect, it } from 'vitest';
import { architectureKeywordWeight } from '../../src/core/intentRouterArchitectureKeywordWeights.js';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';

describe('architectureKeywordWeight', () => {
  it('keeps issue explanation, graph, coupling, and coverage weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_explain_issue', 'explain', 2],
      ['projscan_semantic_graph', 'imports', 2],
      ['projscan_semantic_graph', 'defined', 2],
      ['projscan_coupling', 'circular', 3],
      ['projscan_coupling', 'architecture', 2],
      ['projscan_coverage', 'scariest', 2],
      ['projscan_coverage', 'tests', 2],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(architectureKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves unrelated architecture keywords to the main router fallback', () => {
    expect(architectureKeywordWeight('projscan_explain_issue', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_explain_issue' }, 'review')).toBe(1);
    expect(architectureKeywordWeight('projscan_semantic_graph', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_semantic_graph' }, 'review')).toBe(1);
    expect(architectureKeywordWeight('projscan_coupling', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_coupling' }, 'review')).toBe(1);
    expect(architectureKeywordWeight('projscan_coverage', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_coverage' }, 'review')).toBe(1);
  });
});
