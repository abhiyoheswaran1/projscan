import { describe, expect, test } from 'vitest';
import { buildAdoptionLoop } from '../../src/core/startAdoptionLoop.js';

describe('start adoption loop', () => {
  test('builds the repeat-use adoption loop without changing guidance content', () => {
    const loop = buildAdoptionLoop();

    expect(buildAdoptionLoop).toBeTypeOf('function');
    expect(loop.cadence).toBe('every_pr');
    expect(loop.why).toBe(
      'projscan is useful when it becomes PR muscle memory: comment, fix first, route owners, capture feedback, and compare against the last good baseline.',
    );
    expect(loop.metrics.map((metric) => metric.id)).toEqual([
      'first_pr_useful',
      'manual_review_rate',
      'repeat_use_commands',
      'market_validation_feedback',
    ]);
    expect(loop.metrics.map((metric) => metric.label)).toEqual([
      'First PR usefulness',
      'Manual review rate',
      'Repeat-use commands',
      'Market validation feedback',
    ]);
    expect(loop.metrics.map((metric) => metric.target)).toEqual([
      'Reviewer says the PR comment saved 10-20 minutes or identified one missed risk.',
      'Most uncertain findings stay caution/manual review; actual blocks stay rare and concrete.',
      'Every PR has evidence-pack, preflight, and owner routing before merge.',
      'At least three real reviewers confirm usefulness, minutes saved, prevented risk, and false-positive/noisy-rule status.',
    ]);
    expect(loop.metrics.map((metric) => metric.command)).toEqual([
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      'projscan start --mode before_merge --format json',
      'projscan feedback summary --file .projscan-feedback.json --format json',
    ]);
    expect(loop.nextCommands).toEqual([
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      'projscan feedback init --output .projscan-feedback.json',
      'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
      'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
      'projscan dogfood --repo <path-to-repo> --format json',
    ]);
  });
});
