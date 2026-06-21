import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent feedback routing', () => {
  it('routes raw false-positive feedback to feedback intake before generic analysis tools', () => {
    const result = routeIntent(
      'unused-exports false positive: Next.js App Router and @/ alias import are flagged unused',
    );

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_feedback_intake',
        cli: 'projscan feedback intake',
        confidence: 'high',
      }),
    );
    const semanticGraph = result.matches.find((match) => match.tool === 'projscan_semantic_graph');
    expect(semanticGraph?.rank).toBeGreaterThan(1);
  });

  it('routes raw install warning feedback to feedback intake', () => {
    const result = routeIntent(
      'npm install -g projscan got allow-scripts warnings from tree-sitter-c-sharp node-gyp-build',
    );

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_feedback_intake',
        cli: 'projscan feedback intake',
        confidence: 'high',
      }),
    );
    expect(
      result.matches.find((match) => match.tool === 'projscan_regression_plan')?.rank,
    ).toBeGreaterThan(1);
  });

  it('keeps ordinary install setup prompts away from feedback intake', () => {
    const result = routeIntent('how do I install projscan and set up MCP');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
      }),
    );
    expect(
      result.matches.find((match) => match.tool === 'projscan_feedback_intake'),
    ).toBeUndefined();
  });

  it('routes docs-overclaim feedback to feedback intake without hijacking docs lookup', () => {
    const feedback = routeIntent('docs sound bigger than demonstrated workflows');

    expect(feedback.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_feedback_intake',
        cli: 'projscan feedback intake',
        confidence: 'high',
      }),
    );

    const lookup = routeIntent('where are the setup docs');
    expect(lookup.matches[0].tool).not.toBe('projscan_feedback_intake');
    expect(
      lookup.matches.find((match) => match.tool === 'projscan_feedback_intake'),
    ).toBeUndefined();
  });

  it('routes workflow-focus feedback to intake without hijacking trust-boundary prompts', () => {
    const feedback = routeIntent(
      'feature breadth without a few killer workflows that engineers trust daily',
    );

    expect(feedback.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_feedback_intake',
        cli: 'projscan feedback intake',
        confidence: 'high',
      }),
    );

    const privacy = routeIntent('can projscan upload code or contact the network boundary');
    expect(privacy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_privacy_check',
      }),
    );
  });
});
