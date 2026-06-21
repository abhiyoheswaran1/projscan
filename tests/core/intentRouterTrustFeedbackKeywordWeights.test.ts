import { describe, expect, it } from 'vitest';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';
import { trustFeedbackKeywordWeight } from '../../src/core/intentRouterTrustFeedbackKeywordWeights.js';

describe('trustFeedbackKeywordWeight', () => {
  it('keeps privacy, understand, and feedback-intake weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_privacy_check', 'privacy', 3],
      ['projscan_privacy_check', 'telemetry', 3],
      ['projscan_privacy_check', 'values', 2],
      ['projscan_understand', 'architecture', 2],
      ['projscan_understand', 'onboarding', 2],
      ['projscan_understand', 'typecheck', 2],
      ['projscan_feedback_intake', 'feedback', 3],
      ['projscan_feedback_intake', 'false', 2],
      ['projscan_feedback_intake', 'tree', 3],
      ['projscan_feedback_intake', 'gyp', 2],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(trustFeedbackKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves unrelated keywords to the main router fallback', () => {
    expect(trustFeedbackKeywordWeight('projscan_privacy_check', 'doctor')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_privacy_check' }, 'doctor')).toBe(1);
    expect(trustFeedbackKeywordWeight('projscan_understand', 'privacy')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_understand' }, 'privacy')).toBe(1);
    expect(trustFeedbackKeywordWeight('projscan_feedback_intake', 'doctor')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_feedback_intake' }, 'doctor')).toBe(1);
  });
});
