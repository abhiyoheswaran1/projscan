import { expect, test } from 'vitest';
import '../../src/types/workplan.js';
import type {
  FixFirstRecommendation,
  WorkplanCoordination,
  WorkplanEvidence,
  WorkplanMode,
  WorkplanPriority,
  WorkplanReport,
  WorkplanTask,
  WorkplanTopRisk,
  WorkplanVerification,
} from '../../src/types/workplan.js';
import type {
  FixFirstRecommendation as BarrelFixFirstRecommendation,
  SessionConflict as BarrelSessionConflict,
  WorkplanCoordination as BarrelWorkplanCoordination,
  WorkplanEvidence as BarrelWorkplanEvidence,
  WorkplanMode as BarrelWorkplanMode,
  WorkplanPriority as BarrelWorkplanPriority,
  WorkplanReport as BarrelWorkplanReport,
  WorkplanTask as BarrelWorkplanTask,
  WorkplanTopRisk as BarrelWorkplanTopRisk,
  WorkplanVerification as BarrelWorkplanVerification,
} from '../../src/types.js';

const mode: WorkplanMode = 'hardening';
const priority: WorkplanPriority = 'p0';

const evidence: WorkplanEvidence = {
  source: 'coordination',
  message: 'Touched public type surface requires focused verification.',
  severity: 'warning',
  file: 'src/types.ts',
  issueId: 'public-workplan-types',
  tool: 'projscan_file',
};

const verification: WorkplanVerification = {
  commands: ['npm run typecheck'],
  expected: 'Workplan types compile from the module and the legacy barrel.',
};

const fixFirst: FixFirstRecommendation = {
  id: 'fix-workplan-types',
  title: 'Preserve workplan public type exports',
  source: 'quality-scorecard',
  priority,
  whyFirst: 'Public type drift would break downstream TypeScript users.',
  files: ['src/types.ts', 'src/types/workplan.ts'],
  owner: '@platform-team',
  commands: verification.commands,
  expected: verification.expected,
};

const task: WorkplanTask = {
  id: 'wp-public-types',
  priority,
  title: 'Extract Workplan type declarations',
  why: 'The public barrel should stay small enough to review safely.',
  evidence: [evidence],
  files: fixFirst.files,
  owner: fixFirst.owner,
  suggestedTools: ['projscan_file'],
  verification,
  handoffText: 'Verify module and barrel imports before handoff.',
};

const sessionConflict: BarrelSessionConflict = {
  kind: 'same-file',
  files: ['src/types.ts'],
  message: 'Two agents touched the public type barrel.',
  severity: 'warning',
};
const moduleConflict: WorkplanCoordination['conflicts'][number] = sessionConflict;
const barrelConflict: BarrelSessionConflict = moduleConflict;

const topRisk: WorkplanTopRisk = {
  ...evidence,
  priority,
  owner: fixFirst.owner,
};

const coordination: WorkplanCoordination = {
  touchedFiles: ['src/types.ts'],
  conflicts: [moduleConflict],
  recommendedNextAgent: 'Run typecheck and projscan file before handoff.',
};

const report: WorkplanReport = {
  schemaVersion: 1,
  mode,
  verdict: 'caution',
  summary: 'Workplan public types compile from a focused module.',
  topRisks: [topRisk],
  tasks: [task],
  fixFirst,
  coordination,
  suggestedNextActions: [
    {
      label: 'Typecheck workplan public types',
      command: 'npm run typecheck',
      tool: 'typecheck',
    },
  ],
};

const barrelMode: BarrelWorkplanMode = mode;
const barrelPriority: BarrelWorkplanPriority = priority;
const barrelEvidence: BarrelWorkplanEvidence = evidence;
const barrelVerification: BarrelWorkplanVerification = verification;
const barrelFixFirst: BarrelFixFirstRecommendation = fixFirst;
const barrelTask: BarrelWorkplanTask = task;
const barrelTopRisk: BarrelWorkplanTopRisk = topRisk;
const barrelCoordination: BarrelWorkplanCoordination = coordination;
const barrelReport: BarrelWorkplanReport = report;

void [
  barrelMode,
  barrelPriority,
  barrelEvidence,
  barrelVerification,
  barrelFixFirst,
  barrelConflict,
  barrelTask,
  barrelTopRisk,
  barrelCoordination,
];

test('workplan public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
});
