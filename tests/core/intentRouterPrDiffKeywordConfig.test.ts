import { expect, test } from 'vitest';
import { ROUTE_CATALOG } from '../../src/core/intentRouterCatalog.js';
import { PR_DIFF_KEYWORDS, PR_DIFF_RELEASE_SUMMARY_KEYWORDS } from '../../src/core/intentRouterPrDiffKeywords.js';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { prDiffKeywordMatches } from '../../src/core/intentRouterPrDiffSignals.js';

function prDiffRoute() {
  const route = ROUTE_CATALOG.find((entry) => entry.tool === 'projscan_pr_diff');
  if (!route) throw new Error('projscan_pr_diff route missing');
  return route;
}

function tokens(...values: string[]): Set<string> {
  return new Set(values);
}

test('keeps PR diff catalog keywords on the shared list', () => {
  expect(prDiffRoute().keywords).toEqual([...PR_DIFF_KEYWORDS]);
});

test('keeps PR diff route-specific weights aligned with the shared list', () => {
  const halfWeightKeywords = new Set(['since', 'branch', 'main', 'base', 'head']);

  for (const keyword of PR_DIFF_KEYWORDS) {
    if (keyword === 'pr') {
      expect(keywordWeight({ tool: 'projscan_pr_diff' }, keyword)).toBe(0.25);
    } else if (halfWeightKeywords.has(keyword)) {
      expect(keywordWeight({ tool: 'projscan_pr_diff' }, keyword)).toBe(0.5);
    } else {
      expect(keywordWeight({ tool: 'projscan_pr_diff' }, keyword)).toBe(2);
    }
  }
});

test('keeps release-summary PR diff keywords behind release-summary context', () => {
  const releaseSummary = tokens('what', 'did', 'we', 'implement', 'since', 'last', 'release');
  const plainBuildNext = tokens('what', 'should', 'we', 'implement', 'next');

  for (const keyword of PR_DIFF_RELEASE_SUMMARY_KEYWORDS) {
    expect(prDiffKeywordMatches(keyword, releaseSummary)).toBe(true);
    expect(prDiffKeywordMatches(keyword, plainBuildNext)).toBe(false);
  }
});
