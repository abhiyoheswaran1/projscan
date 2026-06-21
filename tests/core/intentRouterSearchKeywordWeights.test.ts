import { describe, expect, it } from 'vitest';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { searchKeywordWeight } from '../../src/core/intentRouterSearchKeywordWeights.js';

describe('searchKeywordWeight', () => {
  it('keeps search-specific keyword weights aligned with the router', () => {
    for (const keyword of [
      'welcome',
      'reset',
      'prisma',
      'docker',
      'openapi',
      'client',
      'store',
      'sidebar',
      'page',
      'design',
      'form',
      'check',
      'tsconfig',
    ]) {
      expect(searchKeywordWeight(keyword)).toBe(2);
      expect(keywordWeight({ tool: 'projscan_search' }, keyword)).toBe(2);
    }
  });

  it('leaves default search route weights to the main router fallback', () => {
    expect(searchKeywordWeight('review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_search' }, 'review')).toBe(1);
  });
});
