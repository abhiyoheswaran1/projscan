import { expect, test } from 'vitest';
import type {
  AssessMode,
  AssessProofCard,
  AssessReport,
  RiskDeltaSnapshot,
} from '../../src/types/assess.js';
import type { AssessReport as BarrelAssessReport } from '../../src/types.js';

const mode: AssessMode = 'fix-first';
const delta: RiskDeltaSnapshot = {
  baselineScore: 62,
  projectedScore: 78,
  delta: 16,
  basis: ['health score 100', '1 p1 proof card'],
};

const card: AssessProofCard = {
  id: 'proof-hotspot-src-core-bughunt-ts',
  priority: 'p1',
  source: 'hotspot',
  finding: 'src/core/bugHunt.ts is a maintainability hotspot',
  whyItMatters: 'High-risk files slow reviews and concentrate regressions.',
  files: ['src/core/bugHunt.ts'],
  evidence: [{ source: 'quality-scorecard', detail: 'risk 206' }],
  impact: {
    commands: ['projscan file src/core/bugHunt.ts --format json'],
    affectedAreas: ['maintainability'],
    likelyFiles: ['src/core/bugHunt.ts'],
  },
  recommendedFix: {
    summary: 'Split ranking, evidence, and output shaping into focused helpers.',
    safeChangeShape: 'Extract one pure helper at a time and keep existing tests green.',
  },
  verification: {
    commands: ['projscan quality-scorecard --format json', 'npm test'],
    expected: 'The hotspot remains explainable and tests pass.',
  },
  confidence: 'high',
  suppression: {
    command:
      'projscan feedback intake --text "proof-hotspot-src-core-bughunt-ts: false positive because ..." --format json',
  },
  feedback: {
    command:
      'projscan feedback intake --text "proof-hotspot-src-core-bughunt-ts: ..." --format json',
  },
  riskDelta: delta,
};

const report: AssessReport = {
  schemaVersion: 1,
  goal: 'make this repo safer to ship this week',
  mode,
  verdict: 'watch',
  summary: 'watch: 1 proof-backed action should reduce maintainability risk',
  answers: {
    actuallyRisky: 'Maintainability hotspots are the top current risk.',
    whyRisky: 'The first hotspot combines churn, complexity, or issue evidence.',
    fixFirst: 'Start with src/core/bugHunt.ts.',
    safestChange: 'Make one bounded extraction and keep tests green.',
    testsThatProveIt: ['npm test'],
    riskRemoved: 'Projected risk score improves by 16.',
    shipNow: 'Ship only after the proof commands pass.',
  },
  proofCards: [card],
  fixFirst: card,
  riskDelta: delta,
  commands: ['projscan assess --mode fix-first --format json'],
  feedback: [card.feedback.command],
};

const barrel: BarrelAssessReport = report;

test('assess public types compile from focused module and barrel', () => {
  expect(barrel.proofCards[0]?.confidence).toBe('high');
});
