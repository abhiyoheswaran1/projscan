import { describe, expect, it } from 'vitest';
import { fileImpactKeywordWeight } from '../../src/core/intentRouterFileImpactKeywordWeights.js';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';

describe('fileImpactKeywordWeight', () => {
  it('keeps file inspection and impact weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_file', 'read', 3],
      ['projscan_file', 'review', 5],
      ['projscan_file', 'risky', 2],
      ['projscan_file', 'history', 2],
      ['projscan_file', 'add', 2],
      ['projscan_file', 'coverage', 2],
      ['projscan_impact', 'delete', 2],
      ['projscan_impact', 'schema', 2],
      ['projscan_impact', 'rollback', 2],
      ['projscan_impact', 'used', 2],
      ['projscan_impact', 'endpoint', 2],
      ['projscan_impact', 'change', 3],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(fileImpactKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves unrelated file and impact keywords to the main router fallback', () => {
    expect(fileImpactKeywordWeight('projscan_file', 'doctor')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_file' }, 'doctor')).toBe(1);
    expect(fileImpactKeywordWeight('projscan_impact', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_impact' }, 'review')).toBe(1);
  });
});
