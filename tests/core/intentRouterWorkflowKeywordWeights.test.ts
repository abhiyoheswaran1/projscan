import { describe, expect, it } from 'vitest';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { workflowKeywordWeight } from '../../src/core/intentRouterWorkflowKeywordWeights.js';

describe('workflowKeywordWeight', () => {
  it('keeps evidence-pack, release-train, and bug-hunt weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_evidence_pack', 'pr', 0.25],
      ['projscan_evidence_pack', 'changed', 1],
      ['projscan_evidence_pack', 'evidence', 2],
      ['projscan_release_train', 'releasing', 2],
      ['projscan_release_train', 'workstream', 2],
      ['projscan_release_train', 'changelog', 2],
      ['projscan_bug_hunt', 'bug', 2],
      ['projscan_bug_hunt', 'useful', 2],
      ['projscan_bug_hunt', 'pr', 0.25],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(workflowKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves default workflow route weights to the main router fallback', () => {
    expect(workflowKeywordWeight('projscan_evidence_pack', 'doctor')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_evidence_pack' }, 'doctor')).toBe(1);
    expect(workflowKeywordWeight('projscan_release_train', 'pr')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_release_train' }, 'pr')).toBe(1);
    expect(workflowKeywordWeight('projscan_bug_hunt', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_bug_hunt' }, 'review')).toBe(1);
  });
});
