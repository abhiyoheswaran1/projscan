import { expect, test } from 'vitest';
import { compareRiskDeltaSnapshots } from '../../src/core/riskDelta.js';
import type { AssessReport } from '../../src/types.js';

test('compareRiskDeltaSnapshots reports current risk movement from a prior assessment', () => {
  const comparison = compareRiskDeltaSnapshots({
    previous: assessReport(42),
    current: assessReport(57),
    baselinePath: '.projscan/assess-baseline.json',
  });

  expect(comparison).toEqual({
    previousScore: 42,
    currentScore: 57,
    delta: 15,
    baselinePath: '.projscan/assess-baseline.json',
    summary: 'risk score improved by 15 since .projscan/assess-baseline.json',
  });
});

function assessReport(projectedScore: number): AssessReport {
  return {
    schemaVersion: 1,
    goal: 'baseline',
    mode: 'standard',
    verdict: 'watch',
    summary: 'baseline',
    answers: {
      actuallyRisky: '',
      whyRisky: '',
      fixFirst: '',
      safestChange: '',
      testsThatProveIt: [],
      riskRemoved: '',
      shipNow: '',
    },
    proofCards: [],
    riskDelta: {
      baselineScore: projectedScore,
      projectedScore,
      delta: 0,
      basis: [],
    },
    commands: [],
    feedback: [],
  };
}

