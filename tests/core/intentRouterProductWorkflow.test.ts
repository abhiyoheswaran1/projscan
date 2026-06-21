import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent product workflow routing', () => {
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
      expect(
        result.matches.find((match) => match.tool === 'projscan_dataflow')?.rank ?? Infinity,
      ).toBeGreaterThan(1);
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
      expect(
        result.matches.find((match) => match.tool === 'projscan_coordinate')?.rank ?? Infinity,
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
