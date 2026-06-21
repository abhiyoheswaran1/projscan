import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent', () => {
  it('routes explicit issue-fix intents to fix-suggest instead of bug hunt', () => {
    const result = routeIntent('fix issue missing-test-framework');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_fix_suggest',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['fix', 'issue'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.25,
        matchedKeywords: ['fix'],
      }),
    );
  });

  it('routes explicit issue-explanation intents to explain-issue before fix-suggest', () => {
    const result = routeIntent('explain issue missing-test-framework');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_explain_issue',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['explain', 'issue'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_fix_suggest')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['issue'],
      }),
    );
  });

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
    expect(result.matches.find((match) => match.tool === 'projscan_regression_plan')?.rank)
      .toBeGreaterThan(1);
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

  it('routes change-file planning away from dataflow hardening', () => {
    for (const intent of [
      'what files should I change for auth token refresh',
      'which files should I modify for auth token refresh',
      'where should I add auth token refresh',
    ]) {
      const result = routeIntent(intent);
      expect(result.matches[0]).toEqual(
        expect.objectContaining({
          tool: 'projscan_understand',
          confidence: 'high',
        }),
      );
      expect(result.matches.find((match) => match.tool === 'projscan_dataflow')?.rank ?? Infinity)
        .toBeGreaterThan(1);
    }

    const dataflow = routeIntent('trace auth token taint into database sinks');
    expect(dataflow.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
      }),
    );
  });

  it('routes read-only change summaries away from release train', () => {
    for (const intent of [
      'what changed since the last release',
      'show changelog entry for the current work',
      'what have we built since last release',
      'summary of work since last release',
      'what did we implement since the last release',
      'what commits since last release',
    ]) {
      const result = routeIntent(intent);
      expect(result.matches[0]).toEqual(
        expect.objectContaining({
          tool: 'projscan_pr_diff',
          confidence: 'high',
        }),
      );
      expect(
        result.matches.find((match) => match.tool === 'projscan_release_train')?.rank ?? Infinity,
      ).toBeGreaterThan(1);
    }

    const release = routeIntent('prepare this branch for release');
    expect(release.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
      }),
    );
  });

  it('routes no-publish release readiness to evidence pack instead of coordination', () => {
    for (const intent of [
      'is this ready for release without publishing',
      'do not publish, just check release readiness',
    ]) {
      const result = routeIntent(intent);
      expect(result.matches[0]).toEqual(
        expect.objectContaining({
          tool: 'projscan_evidence_pack',
          confidence: 'high',
        }),
      );
      expect(result.matches.find((match) => match.tool === 'projscan_coordinate')?.rank ?? Infinity)
        .toBeGreaterThan(1);
    }

    const release = routeIntent('prepare this branch for release');
    expect(release.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
      }),
    );
  });

  it('routes AI-generated code review-before-commit intents to structural review', () => {
    const result = routeIntent('review AI-generated code before commit for verification debt');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_review',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['review']),
      }),
    );
    expect(
      result.matches.find((match) => match.tool === 'projscan_evidence_pack')?.rank ?? Infinity,
    ).toBeGreaterThan(1);
  });

  it('keeps generic PR/template lookup intents on search instead of bug hunt', () => {
    const result = routeIntent('find the PR template');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['find'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.5,
        matchedKeywords: ['find', 'pr'],
      }),
    );
  });

  it('routes improve-next trust prompts to planning before privacy check', () => {
    const result = routeIntent('what should we improve next to make engineers trust this daily');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        category: 'Agent planning',
        confidence: 'high',
        matchedKeywords: ['improve'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_privacy_check')).toBeUndefined();
  });

  it('keeps explicit privacy and trust-boundary prompts on privacy check', () => {
    const result = routeIntent('can projscan upload code or contact the network boundary');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_privacy_check',
        confidence: 'high',
      }),
    );
  });
});
