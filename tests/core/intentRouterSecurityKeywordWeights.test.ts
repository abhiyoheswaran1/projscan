import { describe, expect, it } from 'vitest';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { securityKeywordWeight } from '../../src/core/intentRouterSecurityKeywordWeights.js';

describe('securityKeywordWeight', () => {
  it('keeps dataflow security weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_dataflow', 'dataflow', 2],
      ['projscan_dataflow', 'security', 2],
      ['projscan_dataflow', 'secrets', 2],
      ['projscan_dataflow', 'sanitize', 2],
      ['projscan_dataflow', 'auth', 2],
      ['projscan_dataflow', 'pii', 2],
      ['projscan_dataflow', 'gdpr', 2],
      ['projscan_dataflow', 'tokens', 2],
      ['projscan_dataflow', 'stores', 2],
      ['projscan_dataflow', 'processing', 2],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(securityKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves unrelated security keywords to the main router fallback', () => {
    expect(securityKeywordWeight('projscan_dataflow', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_dataflow' }, 'review')).toBe(1);
  });
});
