import { expect, test } from 'vitest';
import '../../src/types/agentBrief.js';
import type {
  AgentBriefGuardrail,
  AgentBriefIntent,
  AgentBriefItem,
  AgentBriefReport,
} from '../../src/types/agentBrief.js';
import type {
  AgentBriefGuardrail as BarrelAgentBriefGuardrail,
  AgentBriefIntent as BarrelAgentBriefIntent,
  AgentBriefItem as BarrelAgentBriefItem,
  AgentBriefReport as BarrelAgentBriefReport,
  SessionCoordinationHint as BarrelSessionCoordinationHint,
} from '../../src/types.js';

const intent: AgentBriefIntent = 'next_agent';
const intents: AgentBriefIntent[] = ['next_agent', 'bug_hunt', 'release', 'refactor', 'hardening'];

const focusItem: AgentBriefItem = {
  id: 'ab-public-types',
  priority: 'p1',
  title: 'Verify AgentBrief public types',
  why: 'Downstream callers depend on stable AgentBrief report shapes.',
  files: ['src/types.ts', 'src/types/agentBrief.ts'],
  commands: ['npm run typecheck:public-types'],
};

const guardrail: AgentBriefGuardrail = {
  id: 'ab-typecheck',
  label: 'Typecheck public AgentBrief types',
  reason: 'Public type drift would break downstream TypeScript users.',
  command: 'npm run typecheck:public-types',
};

const coordinationHint: AgentBriefReport['context']['coordinationHints'][number] = {
  id: 'agentloop-task-contract',
  label: 'AgentLoop task contract',
  message: 'Keep the public type extraction tied to the active task contract.',
  command: 'npm exec agentloop -- status',
};
const barrelSessionHint: BarrelSessionCoordinationHint = coordinationHint;
const moduleCoordinationHint: AgentBriefReport['context']['coordinationHints'][number] =
  barrelSessionHint;

const report: AgentBriefReport = {
  schemaVersion: 1,
  intent,
  summary: 'AgentBrief public contracts compile from focused module and barrel imports.',
  health: {
    score: 100,
    grade: 'A',
    errors: 0,
    warnings: 0,
    infos: 0,
  },
  context: {
    totalFiles: 42,
    totalDirectories: 7,
    topDirectories: [{ directory: 'src/types', files: 12 }],
    touchedFiles: ['src/types.ts', 'src/types/agentBrief.ts'],
    conflicts: 0,
    graph: {
      schemaVersion: 1,
      changedFiles: 2,
      changedFunctions: 0,
      totalFunctions: 10,
      totalPackages: 2,
      totalCallEdges: 12,
      dataflowRisks: 0,
      topPackages: ['projscan'],
    },
    coordinationHints: [moduleCoordinationHint],
  },
  focus: [focusItem],
  guardrails: [guardrail],
  suggestedNextActions: [
    {
      label: 'Typecheck AgentBrief public types',
      command: 'npm run typecheck:public-types',
      tool: 'typecheck',
    },
  ],
};

const barrelIntent: BarrelAgentBriefIntent = intent;
const barrelIntents: BarrelAgentBriefIntent[] = intents;
const barrelFocusItem: BarrelAgentBriefItem = focusItem;
const barrelGuardrail: BarrelAgentBriefGuardrail = guardrail;
const barrelReport: BarrelAgentBriefReport = report;

void [barrelIntent, barrelFocusItem, barrelGuardrail];

test('agent brief public types compile from the module and legacy barrel', () => {
  expect(barrelReport).toBe(report);
  expect(barrelIntents).toEqual(['next_agent', 'bug_hunt', 'release', 'refactor', 'hardening']);
  expect(barrelSessionHint).toBe(coordinationHint);
});
