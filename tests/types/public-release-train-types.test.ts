import { expect, test } from 'vitest';
import '../../src/types/releaseTrain.js';
import type {
  ReleaseTrainReport,
  ReleaseTrainTask,
  ReleaseTrainTrack,
} from '../../src/types/releaseTrain.js';
import type {
  ReleaseTrainReport as BarrelReleaseTrainReport,
  ReleaseTrainTask as BarrelReleaseTrainTask,
  ReleaseTrainTrack as BarrelReleaseTrainTrack,
} from '../../src/types.js';

const track: ReleaseTrainTrack = {
  line: '4.4.x',
  theme: 'Public type surface hardening',
  outcome: 'Release train planning remains readable and reviewable.',
  includedInPlan: true,
  scope: ['type module extraction', 'barrel compatibility'],
  successCriteria: ['release train types compile from module and barrel imports'],
};

const task: ReleaseTrainTask = {
  id: 'rt-public-types',
  priority: 'p1',
  title: 'Extract Release Train public types',
  why: 'The public type barrel should keep related contracts in focused modules.',
  track: track.line,
  files: ['src/types.ts', 'src/types/releaseTrain.ts'],
  verification: {
    commands: ['npm run typecheck'],
    expected: 'Release Train types compile from the module and legacy barrel.',
  },
};

const report: ReleaseTrainReport = {
  schemaVersion: 1,
  currentVersion: '4.3.1',
  plan: {
    policy: 'product-readiness-plan',
    lines: [track.line],
    readOnly: true,
  },
  readiness: {
    verdict: 'caution',
    blockers: 0,
    cautions: 1,
    summary: 'Review public type compatibility before release.',
  },
  tracks: [track],
  tasks: [task],
  suggestedNextActions: [
    {
      label: 'Typecheck release train public types',
      command: 'npm run typecheck',
      tool: 'typecheck',
    },
  ],
};

const barrelTrack: BarrelReleaseTrainTrack = track;
const barrelTask: BarrelReleaseTrainTask = task;
const barrelReport: BarrelReleaseTrainReport = report;

void [barrelTrack, barrelTask];

test('release train public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
});
