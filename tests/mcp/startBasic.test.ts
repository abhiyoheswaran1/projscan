import { beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
});

test('lists projscan_start as an MCP tool', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_start');

  expect(tool).toBeDefined();
  expect(tool?.inputSchema.properties).toEqual(
    expect.objectContaining({
      mode: expect.objectContaining({
        enum: expect.arrayContaining(['before_edit', 'bug_hunt', 'release']),
      }),
      intent: expect.objectContaining({ type: 'string' }),
      mission_dir: expect.objectContaining({ type: 'string' }),
      include_handoff: expect.objectContaining({ type: 'boolean' }),
      max_tokens: expect.objectContaining({ type: 'number' }),
    }),
  );
});

test('projscan_start returns first-run guidance and next actions', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    {
      mode: 'release',
      max_tasks: 2,
      include_handoff: true,
      intent: 'prepare this branch for release',
    },
    tmp,
  )) as {
    start: {
      schemaVersion: number;
      mode: string;
      modeSource: string;
      modeReason: string;
      recommendedWorkflow: { id: string; commands: string[] };
      missionControl: {
        intent?: string;
        primaryAction: { command?: string; tool?: string; args?: Record<string, unknown> };
        actionPlan: Array<{ command?: string; tool?: string; args?: Record<string, unknown> }>;
        readyActions: Array<{ command?: string; tool?: string; args?: Record<string, unknown> }>;
        routedIntent?: {
          tool: string;
          cli: string;
          confidence: string;
          matchedKeywords: string[];
          score: number;
        };
        successCriteria: string[];
        proofCommands: string[];
      };
      nextActions: Array<{ command?: string }>;
      firstTenMinutes: { commands: Array<{ command: string }> };
      handoff?: { next: string[] };
    };
  };

  expect(result.start.schemaVersion).toBe(1);
  expect(result.start.mode).toBe('release');
  expect(result.start.modeSource).toBe('explicit');
  expect(result.start.recommendedWorkflow.id).toBe('release_approval');
  expect(result.start.recommendedWorkflow.commands).toContain(
    'projscan release-train --format json',
  );
  expect(result.start.missionControl.intent).toBe('prepare this branch for release');
  expect(result.start.missionControl.routedIntent?.tool).toBe('projscan_release_train');
  expect(result.start.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['release', 'prepare'],
      score: 2,
    }),
  );
  expect(result.start.missionControl.primaryAction.command).toBe(
    'projscan release-train --format json',
  );
  expect(result.start.missionControl.primaryAction.args).toEqual({});
  expect(result.start.missionControl.actionPlan[0]?.command).toBe(
    'projscan release-train --format json',
  );
  expect(result.start.missionControl.actionPlan[0]?.args).toEqual({});
  expect(result.start.missionControl.readyActions[0]).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );
  expect(result.start.missionControl.successCriteria).toContain(
    'Release train readiness has no blockers before packaging or publishing continues.',
  );
  expect(result.start.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_merge --format json',
  );
  expect(result.start.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
  expect(result.start.nextActions.length).toBeGreaterThan(0);
  expect(result.start.handoff?.next.length).toBeGreaterThan(0);
});

test('projscan_start infers mode from safety-gate intent when no mode is supplied', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    {
      intent: 'is it safe to commit this change',
    },
    tmp,
  )) as {
    start: {
      mode: string;
      modeSource: string;
      modeReason: string;
      recommendedWorkflow: { id: string };
      missionControl: {
        primaryAction: { command?: string; tool?: string; args?: Record<string, unknown> };
        successCriteria: string[];
        proofCommands: string[];
      };
    };
  };

  expect(result.start.mode).toBe('before_commit');
  expect(result.start.modeSource).toBe('intent');
  expect(result.start.modeReason).toContain('is it safe to commit this change');
  expect(result.start.recommendedWorkflow.id).toBe('before_handoff');
  expect(result.start.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan assess --mode fix-first --format json',
      tool: 'projscan_assess',
      args: { mode: 'fix-first' },
    }),
  );
  expect(result.start.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
  expect(result.start.missionControl.proofCommands).not.toContain(
    'projscan preflight --mode before_edit --format json',
  );
  expect(result.start.missionControl.successCriteria).toContain(
    'projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
  );
});
