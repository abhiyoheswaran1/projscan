import { architectureKeywordWeight } from './intentRouterArchitectureKeywordWeights.js';
import { dependencyKeywordWeight } from './intentRouterDependencyKeywordWeights.js';
import { fileImpactKeywordWeight } from './intentRouterFileImpactKeywordWeights.js';
import { isPrDiffKeyword } from './intentRouterPrDiffKeywords.js';
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
  if (entry.tool === 'projscan_agent_brief' && ['brief', 'handoff', 'agent'].includes(keyword))
    return 2;
  if (
    entry.tool === 'projscan_session' &&
    [
      'session',
      'touched',
      'touch',
      'resume',
      'leave',
      'left',
      'off',
      'agent',
      'asleep',
      'slept',
      'away',
      'offline',
      'changed',
      'events',
      'history',
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_quality_scorecard' &&
    ['quality', 'scorecard', 'risk', 'risks', 'risky', 'picture'].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_hotspots' &&
    [
      'files',
      'file',
      'touch',
      'complexity',
      'complex',
      'refactor',
      'refactoring',
      'simplify',
      'simplification',
      'tech',
      'debt',
      'duplicate',
      'duplicated',
      'duplication',
      'over',
      'engineered',
      'performance',
      'perf',
      'bottleneck',
      'bottlenecks',
      'optimize',
      'optimise',
      'faster',
      'slow',
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_coordinate' &&
    [
      'who',
      'else',
      'working',
      'editing',
      'coordinate',
      'coordination',
      'status',
      'readiness',
      'parallel',
      'agents',
      'agent',
      'collide',
      'colliding',
      'swarm',
      'conflict',
      'conflicts',
      'conflicting',
      'conflicted',
      'active',
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_preflight' && keyword === 'ready') return 2;
  if (
    entry.tool === 'projscan_preflight' &&
    ['block', 'blocked', 'blocker', 'blockers', 'blocking'].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_preflight' && ['risk', 'risks'].includes(keyword)) return 2;
  if (
    entry.tool === 'projscan_preflight' &&
    [
      'rebase',
      'rebasing',
      'conflict',
      'conflicts',
      'resolve',
      'resolving',
      'wrong',
      'stuck',
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_claim') {
    if (keyword === 'active') return 0.5;
    if (['claim', 'claims', 'lease', 'leases', 'reserve', 'lock'].includes(keyword)) return 2;
  }
  if (entry.tool === 'projscan_analyze') {
    if (['redact', 'redacted', 'redaction', 'scoped', 'scope'].includes(keyword)) return 3;
    if (
      [
        'share',
        'shared',
        'shareable',
        'sharing',
        'evidence',
        'artifact',
        'artifacts',
        'export',
        'exports',
        'external',
        'partner',
        'vendor',
        'security',
        'paths',
        'report',
        'reports',
      ].includes(keyword)
    )
      return 2;
  }
  const workflowWeight = workflowKeywordWeight(entry.tool, keyword);
  if (workflowWeight !== undefined) return workflowWeight;
  if (entry.tool === 'projscan_doctor') {
    if (keyword === 'unused') return 3;
    if (['dead', 'orphaned'].includes(keyword)) return 2;
    if (['delete', 'remove'].includes(keyword)) return 2;
    if (['safe', 'safely'].includes(keyword)) return 1;
  }
  if (entry.tool === 'projscan_review' && keyword === 'review') return 2;
  if (entry.tool === 'projscan_review' && keyword === 'pr') return 0.25;
  if (entry.tool === 'projscan_review' && ['secure', 'security'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_review' && ['risk', 'risks', 'risky'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_pr_diff') {
    if (keyword === 'pr') return 0.25;
    if (['since', 'branch', 'main', 'base', 'head'].includes(keyword)) return 0.5;
    if (isPrDiffKeyword(keyword)) return 2;
  }
  if (entry.tool === 'projscan_collision' && ['overlapping'].includes(keyword)) return 3;
  if (entry.tool === 'projscan_collision' && ['collide', 'colliding'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_merge_risk' && keyword === 'first') return 1;
  return 1;
}
