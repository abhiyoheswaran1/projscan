import { architectureKeywordWeight } from './intentRouterArchitectureKeywordWeights.js';
import { dependencyKeywordWeight } from './intentRouterDependencyKeywordWeights.js';
import { fileImpactKeywordWeight } from './intentRouterFileImpactKeywordWeights.js';
import { operationalKeywordWeight } from './intentRouterOperationalKeywordWeights.js';
import { regressionPlanKeywordWeight } from './intentRouterRegressionKeywordWeights.js';
import { searchKeywordWeight } from './intentRouterSearchKeywordWeights.js';
import { securityKeywordWeight } from './intentRouterSecurityKeywordWeights.js';
import { trustFeedbackKeywordWeight } from './intentRouterTrustFeedbackKeywordWeights.js';
import { workflowKeywordWeight } from './intentRouterWorkflowKeywordWeights.js';

export interface KeywordWeightedRouteEntry {
  tool: string;
}

type KeywordWeighter = (entry: KeywordWeightedRouteEntry, keyword: string) => number | undefined;

const KEYWORD_WEIGHTERS: readonly KeywordWeighter[] = [
  ({ tool }, keyword) => trustFeedbackKeywordWeight(tool, keyword),
  ({ tool }, keyword) => fileImpactKeywordWeight(tool, keyword),
  ({ tool }, keyword) => architectureKeywordWeight(tool, keyword),
  ({ tool }, keyword) => dependencyKeywordWeight(tool, keyword),
  ({ tool }, keyword) => securityKeywordWeight(tool, keyword),
  ({ tool }, keyword) => (tool === 'projscan_search' ? searchKeywordWeight(keyword) : undefined),
  ({ tool }, keyword) =>
    tool === 'projscan_regression_plan' ? regressionPlanKeywordWeight(keyword) : undefined,
  ({ tool }, keyword) => workflowKeywordWeight(tool, keyword),
  ({ tool }, keyword) => operationalKeywordWeight(tool, keyword),
];

export function keywordWeight(entry: KeywordWeightedRouteEntry, keyword: string): number {
  for (const weighter of KEYWORD_WEIGHTERS) {
    const weight = weighter(entry, keyword);
    if (weight !== undefined) return weight;
  }
  return 1;
}
