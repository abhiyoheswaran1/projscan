import { expect, test } from 'vitest';
import {
  hasProhibitedWorkflowModeAction,
  preflightModeFromIntent,
  resolveStartMode,
  routesForIntent,
} from '../../src/core/startMode.js';

test('start mode resolution preserves explicit mode and reason text', () => {
  expect(resolveStartMode('release', 'find bugs to fix before the PR')).toEqual({
    mode: 'release',
    source: 'explicit',
    reason: 'Mode release was provided explicitly.',
  });
});

test('start mode resolution infers workflows from routed intent', () => {
  const cases = [
    ['prepare this branch for release', 'release'],
    ['find bugs to fix before the PR', 'bug_hunt'],
    ['what should I do next', 'before_edit'],
    ['prepare this branch for handoff', 'before_commit'],
    ['is user input reaching SQL sinks', 'hardening'],
    ['what full regression should I run before merge', 'before_merge'],
    ['how risky is this PR before merge', 'before_merge'],
  ] as const;

  for (const [intent, mode] of cases) {
    expect(resolveStartMode(undefined, intent)).toEqual({
      mode,
      source: 'intent',
      reason: `Intent "${intent}" maps to the ${mode} workflow.`,
    });
  }
});

test('start mode resolution uses preflight alternatives when the primary route has no mode', () => {
  const intent = 'is it safe to commit and what breaks if I rename the auth token loader';

  expect(routesForIntent(intent)[0]?.tool).toBe('projscan_impact');
  expect(routesForIntent(intent).some((route) => route.tool === 'projscan_preflight')).toBe(true);
  expect(resolveStartMode(undefined, intent)).toEqual({
    mode: 'before_commit',
    source: 'intent',
    reason: `Intent "${intent}" maps to the before_commit workflow.`,
  });
});

test('start mode resolution keeps no-more-release continuation intents out of release workflow', () => {
  const intent =
    'keep improving projscan after 4.8.0 with user research and no more release today';

  expect(hasProhibitedWorkflowModeAction(intent)).toBe(true);
  expect(resolveStartMode(undefined, intent)).toEqual({
    mode: 'before_edit',
    source: 'intent',
    reason: `Intent "${intent}" maps to the before_edit workflow.`,
  });
});

test('start mode resolution keeps routed and empty default reason text', () => {
  const routedIntent = 'what breaks if I rename the auth token loader';

  expect(resolveStartMode(undefined, routedIntent)).toEqual({
    mode: 'before_edit',
    source: 'default',
    reason: `Mission Control routed the intent, but no workflow-mode hint matched "${routedIntent}", so start defaults to before_edit.`,
  });
  expect(resolveStartMode(undefined, undefined)).toEqual({
    mode: 'before_edit',
    source: 'default',
    reason:
      'No mode-specific intent or explicit mode was supplied, so start defaults to before_edit.',
  });
});

test('routesForIntent normalizes router matches into start routed intent shape', () => {
  const [route] = routesForIntent('what breaks if I rename the auth token loader');

  expect(route).toEqual(
    expect.objectContaining({
      intent: 'See what breaks if I change something',
      category: 'Impact',
      tool: 'projscan_impact',
      cli: 'projscan impact',
      confidence: 'high',
      rank: expect.any(Number),
      score: expect.any(Number),
      matchedKeywords: expect.arrayContaining(['breaks', 'rename']),
    }),
  );
});

test('preflightModeFromIntent maps edit, commit, and merge wording to preflight levels', () => {
  expect(preflightModeFromIntent('can I start editing this file')).toBe('before_edit');
  expect(preflightModeFromIntent('is it safe to commit this change')).toBe('before_commit');
  expect(preflightModeFromIntent('is this branch ready to hand off')).toBe('before_commit');
  expect(preflightModeFromIntent('is my branch ready to merge')).toBe('before_merge');
});
