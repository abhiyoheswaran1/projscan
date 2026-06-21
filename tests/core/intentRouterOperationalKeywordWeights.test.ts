import { describe, expect, it } from 'vitest';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { operationalKeywordWeight } from '../../src/core/intentRouterOperationalKeywordWeights.js';

describe('operationalKeywordWeight', () => {
  it('keeps operational workflow weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_agent_brief', 'brief', 2],
      ['projscan_session', 'offline', 2],
      ['projscan_quality_scorecard', 'risky', 2],
      ['projscan_hotspots', 'refactor', 2],
      ['projscan_coordinate', 'parallel', 2],
      ['projscan_preflight', 'ready', 2],
      ['projscan_preflight', 'blocking', 2],
      ['projscan_preflight', 'risk', 2],
      ['projscan_preflight', 'rebase', 2],
      ['projscan_claim', 'active', 0.5],
      ['projscan_claim', 'claim', 2],
      ['projscan_analyze', 'redact', 3],
      ['projscan_analyze', 'sharing', 2],
      ['projscan_doctor', 'unused', 3],
      ['projscan_doctor', 'dead', 2],
      ['projscan_doctor', 'safe', 1],
      ['projscan_review', 'review', 2],
      ['projscan_review', 'pr', 0.25],
      ['projscan_review', 'security', 2],
      ['projscan_review', 'risky', 2],
      ['projscan_pr_diff', 'pr', 0.25],
      ['projscan_pr_diff', 'since', 0.5],
      ['projscan_pr_diff', 'changes', 2],
      ['projscan_collision', 'overlapping', 3],
      ['projscan_collision', 'collide', 2],
      ['projscan_merge_risk', 'first', 1],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(operationalKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves unrelated operational keywords to the main router fallback', () => {
    expect(operationalKeywordWeight('projscan_agent_brief', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_agent_brief' }, 'review')).toBe(1);
    expect(operationalKeywordWeight('projscan_preflight', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_preflight' }, 'review')).toBe(1);
    expect(operationalKeywordWeight('projscan_pr_diff', 'doctor')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_pr_diff' }, 'doctor')).toBe(1);
  });
});
