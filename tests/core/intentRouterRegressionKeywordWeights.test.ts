import { describe, expect, it } from 'vitest';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { regressionPlanKeywordWeight } from '../../src/core/intentRouterRegressionKeywordWeights.js';

describe('regressionPlanKeywordWeight', () => {
  it('keeps regression-plan keyword weights aligned with the router', () => {
    const cases: Array<[string, number]> = [
      ['warning', 4],
      ['agentflight', 4],
      ['port', 3],
      ['eaddrinuse', 3],
      ['failed', 2],
      ['verification', 2],
      ['flake', 2],
      ['pr', 0.25],
    ];

    for (const [keyword, weight] of cases) {
      expect(regressionPlanKeywordWeight(keyword)).toBe(weight);
      expect(keywordWeight({ tool: 'projscan_regression_plan' }, keyword)).toBe(weight);
    }
  });

  it('leaves default regression-plan route weights to the main router fallback', () => {
    expect(regressionPlanKeywordWeight('review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_regression_plan' }, 'review')).toBe(1);
  });
});
