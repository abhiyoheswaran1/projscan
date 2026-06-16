import { expect, test } from 'vitest';
import '../../src/types/regressionPlan.js';
import type {
  RegressionPlanLevel,
  RegressionPlanReport,
  RegressionPlanTarget,
  RegressionPlanVerdict,
} from '../../src/types/regressionPlan.js';
import type {
  RegressionPlanLevel as BarrelRegressionPlanLevel,
  RegressionPlanReport as BarrelRegressionPlanReport,
  RegressionPlanTarget as BarrelRegressionPlanTarget,
  RegressionPlanVerdict as BarrelRegressionPlanVerdict,
} from '../../src/types.js';

const level: RegressionPlanLevel = 'focused';
const verdict: RegressionPlanVerdict = 'needs_tests';
const levels: RegressionPlanLevel[] = ['smoke', 'focused', 'full'];
const verdicts: RegressionPlanVerdict[] = ['ready', 'needs_tests', 'blocked'];
const targetSources: Array<RegressionPlanTarget['source']> = [
  'baseline',
  'bug-hunt',
  'product-line',
  'preflight',
];

const target: RegressionPlanTarget = {
  id: 'rp-public-types',
  priority: 'p1',
  source: 'preflight',
  title: 'Verify RegressionPlan public types',
  why: 'Downstream callers depend on stable regression plan report shapes.',
  files: ['src/types.ts', 'src/types/regressionPlan.ts'],
  verification: {
    commands: ['npm run typecheck:public-types'],
    expected: 'RegressionPlan types compile from the module and legacy barrel.',
  },
};

const report: RegressionPlanReport = {
  schemaVersion: 1,
  level,
  verdict,
  summary: 'RegressionPlan public contracts compile from focused module and barrel imports.',
  releaseLines: ['4.4.x'],
  evidence: {
    healthScore: 100,
    bugHuntVerdict: 'fix',
    preflightVerdict: 'caution',
    changedFiles: 2,
    touchedFiles: 2,
  },
  targets: [target],
  commands: ['npm run typecheck:public-types'],
  suggestedNextActions: [
    {
      label: 'Typecheck RegressionPlan public types',
      command: 'npm run typecheck:public-types',
      tool: 'typecheck',
    },
  ],
};

const barrelLevel: BarrelRegressionPlanLevel = level;
const barrelVerdict: BarrelRegressionPlanVerdict = verdict;
const barrelLevels: BarrelRegressionPlanLevel[] = levels;
const barrelVerdicts: BarrelRegressionPlanVerdict[] = verdicts;
const barrelTargetSources: Array<BarrelRegressionPlanTarget['source']> = targetSources;
const barrelTarget: BarrelRegressionPlanTarget = target;
const barrelReport: BarrelRegressionPlanReport = report;

void [barrelLevel, barrelVerdict, barrelTarget];

test('regression plan public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
  expect(barrelLevels).toEqual(['smoke', 'focused', 'full']);
  expect(barrelVerdicts).toEqual(['ready', 'needs_tests', 'blocked']);
  expect(barrelTargetSources).toEqual(['baseline', 'bug-hunt', 'product-line', 'preflight']);
});
