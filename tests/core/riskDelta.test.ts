import { expect, test } from 'vitest';
import { computeRiskDelta } from '../../src/core/riskDelta.js';

test('risk delta improves when a p1 proof card is selected', () => {
  const delta = computeRiskDelta({
    healthScore: 100,
    qualityVerdict: 'needs_attention',
    preflightVerdict: 'caution',
    proofCards: [
      { id: 'a', priority: 'p1', source: 'hotspot' },
      { id: 'b', priority: 'p2', source: 'issue' },
    ],
    selectedCardIds: ['a'],
  });

  expect(delta.projectedScore).toBeGreaterThan(delta.baselineScore);
  expect(delta.delta).toBe(delta.projectedScore - delta.baselineScore);
  expect(delta.basis.join(' ')).toContain('p1');
});

test('risk delta stays in score bounds', () => {
  const delta = computeRiskDelta({
    healthScore: 8,
    qualityVerdict: 'blocked',
    preflightVerdict: 'block',
    proofCards: [
      { id: 'a', priority: 'p0', source: 'issue' },
      { id: 'b', priority: 'p0', source: 'issue' },
      { id: 'c', priority: 'p1', source: 'hotspot' },
    ],
    selectedCardIds: ['a', 'b', 'c'],
  });

  expect(delta.baselineScore).toBeGreaterThanOrEqual(0);
  expect(delta.projectedScore).toBeLessThanOrEqual(100);
});
