import type { StartAdoptionLoop } from '../types/start.js';

export function buildAdoptionLoop(): StartAdoptionLoop {
  return {
    cadence: 'every_pr',
    why: 'projscan is useful when it becomes PR muscle memory: comment, fix first, route owners, capture feedback, and compare against the last good baseline.',
    metrics: [
      {
        id: 'first_pr_useful',
        label: 'First PR usefulness',
        target: 'Reviewer says the PR comment saved 10-20 minutes or identified one missed risk.',
        command: 'projscan evidence-pack --pr-comment',
      },
      {
        id: 'manual_review_rate',
        label: 'Manual review rate',
        target:
          'Most uncertain findings stay caution/manual review; actual blocks stay rare and concrete.',
        command: 'projscan preflight --mode before_merge --format json',
      },
      {
        id: 'repeat_use_commands',
        label: 'Repeat-use commands',
        target: 'Every PR has evidence-pack, preflight, and owner routing before merge.',
        command: 'projscan start --mode before_merge --format json',
      },
      {
        id: 'market_validation_feedback',
        label: 'Market validation feedback',
        target:
          'At least three real reviewers confirm usefulness, minutes saved, prevented risk, and false-positive/noisy-rule status.',
        command: 'projscan feedback summary --file .projscan-feedback.json --format json',
      },
    ],
    nextCommands: [
      'projscan evidence-pack --pr-comment',
      'projscan preflight --mode before_merge --format json',
      'projscan feedback init --output .projscan-feedback.json',
      'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
      'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
      'projscan dogfood --repo <path-to-repo> --format json',
    ],
  };
}
