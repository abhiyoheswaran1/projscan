import { expect, test } from 'vitest';
import '../../src/types/session.js';
import type {
  RiskNowResource,
  SessionConflict,
  SessionCoordinationHint,
  SessionHandoff,
  SessionResourceSummary,
} from '../../src/types/session.js';
import type {
  RiskNowResource as BarrelRiskNowResource,
  SessionConflict as BarrelSessionConflict,
  SessionCoordinationHint as BarrelSessionCoordinationHint,
  SessionHandoff as BarrelSessionHandoff,
  SessionResourceSummary as BarrelSessionResourceSummary,
} from '../../src/types.js';

const hintIds: SessionCoordinationHint['id'][] = [
  'current-worktree-check',
  'remembered-session-context',
  'resolve-conflicts',
  'swarm-coordination',
  'agentloop-task-contract',
  'agentflight-verification',
];

const hints: SessionCoordinationHint[] = hintIds.map((id) => ({
  id,
  label: id,
  message: `Handle ${id}.`,
  command: `projscan ${id}`,
}));

const barrelHints: BarrelSessionCoordinationHint[] = hints;
const moduleHint: SessionCoordinationHint = barrelHints[0];

const conflict: SessionConflict = {
  kind: 'same-file',
  files: ['src/types.ts'],
  message: 'Two agents touched the public type barrel.',
  severity: 'warning',
};
const barrelConflict: BarrelSessionConflict = conflict;
const moduleConflict: SessionConflict = barrelConflict;

const summary: SessionResourceSummary = {
  schemaVersion: 1,
  sessionId: 'session-public-types',
  touchedFiles: ['src/types.ts'],
  recentIssues: [
    {
      id: 'session-type-coverage',
      title: 'Cover session public types',
      description: 'Session coordination literals need explicit public type coverage.',
      severity: 'warning',
      category: 'public-api',
      fixAvailable: false,
    },
  ],
  highRiskTouchedFiles: [{ file: 'src/types.ts', riskScore: 180 }],
  staleSignals: ['public-barrel-large'],
  coordinationHints: hints,
};
const barrelSummary: BarrelSessionResourceSummary = summary;
const moduleSummary: SessionResourceSummary = barrelSummary;

const handoff: SessionHandoff = {
  schemaVersion: 1,
  summary,
  remainingRisks: [conflict],
  suggestedNextActions: [
    {
      label: 'Run public typecheck',
      command: 'npm run typecheck:public-types',
      tool: 'typecheck',
    },
  ],
  coordinationHints: hints,
  avoidRepeating: ['Do not drop legacy barrel exports while moving public types.'],
};
const barrelHandoff: BarrelSessionHandoff = handoff;
const moduleHandoff: SessionHandoff = barrelHandoff;

const riskNow: RiskNowResource = {
  schemaVersion: 1,
  conflicts: [conflict],
  touchedFiles: summary.touchedFiles,
  coordinationHints: hints,
};
const barrelRiskNow: BarrelRiskNowResource = riskNow;
const moduleRiskNow: RiskNowResource = barrelRiskNow;

void [moduleHint, moduleConflict, moduleSummary, moduleHandoff, moduleRiskNow];

test('session public types compile from the module and legacy barrel', () => {
  expect(hintIds).toEqual([
    'current-worktree-check',
    'remembered-session-context',
    'resolve-conflicts',
    'swarm-coordination',
    'agentloop-task-contract',
    'agentflight-verification',
  ]);
  expect(moduleSummary.coordinationHints).toHaveLength(6);
  expect(moduleHandoff.remainingRisks[0].kind).toBe('same-file');
  expect(moduleRiskNow.coordinationHints[5].id).toBe('agentflight-verification');
});
