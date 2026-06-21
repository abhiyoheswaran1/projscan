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

export function keywordWeight(entry: KeywordWeightedRouteEntry, keyword: string): number {
  const trustFeedbackWeight = trustFeedbackKeywordWeight(entry.tool, keyword);
  if (trustFeedbackWeight !== undefined) return trustFeedbackWeight;
  const fileImpactWeight = fileImpactKeywordWeight(entry.tool, keyword);
  if (fileImpactWeight !== undefined) return fileImpactWeight;
  const architectureWeight = architectureKeywordWeight(entry.tool, keyword);
  if (architectureWeight !== undefined) return architectureWeight;
  const dependencyWeight = dependencyKeywordWeight(entry.tool, keyword);
  if (dependencyWeight !== undefined) return dependencyWeight;
  const securityWeight = securityKeywordWeight(entry.tool, keyword);
  if (securityWeight !== undefined) return securityWeight;
  if (entry.tool === 'projscan_search') {
    const weight = searchKeywordWeight(keyword);
    if (weight !== undefined) return weight;
  }
  if (entry.tool === 'projscan_regression_plan') {
    const weight = regressionPlanKeywordWeight(keyword);
    if (weight !== undefined) return weight;
  }
  const workflowWeight = workflowKeywordWeight(entry.tool, keyword);
  if (workflowWeight !== undefined) return workflowWeight;
  const operationalWeight = operationalKeywordWeight(entry.tool, keyword);
  if (operationalWeight !== undefined) return operationalWeight;
  return 1;
}
