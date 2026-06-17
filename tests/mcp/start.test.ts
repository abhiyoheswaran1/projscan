import { beforeEach, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { getToolHandler } from '../../src/mcp/tools.js';
import type { StartReport } from '../../src/types/start.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;
beforeEach(async () => {
  tmp = await makeTempProject();
});

test('projscan_start exposes complete remaining proof items for handoff intents', async () => {
  const handler = getToolHandler('projscan_start');
  const { session } = await loadSession(tmp);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(tmp, session);

  const result = (await handler?.(
    {
      intent: 'give the next agent a handoff',
    },
    tmp,
  )) as { start: StartReport };

  expect(result.start.missionControl.resume.remainingProofCommands).toContain('projscan handoff');
  expect(
    result.start.missionControl.resume.remainingProofToolCalls?.map((call) => call.command),
  ).not.toContain('projscan handoff');
  expect(
    result.start.missionControl.resume.remainingProofItems?.map((item) => item.command),
  ).toEqual(result.start.missionControl.resume.remainingProofCommands);
  expect(result.start.missionControl.resume.remainingProofItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        stepId: 'proof-2',
        command: 'projscan preflight --mode before_edit --format json',
        toolCall: {
          tool: 'projscan_preflight',
          args: { mode: 'before_edit' },
        },
      }),
      expect.objectContaining({
        stepId: 'proof-6',
        command: 'projscan handoff',
      }),
    ]),
  );
  expect(
    result.start.missionControl.resume.remainingProofItems?.find(
      (item) => item.command === 'projscan handoff',
    )?.toolCall,
  ).toBeUndefined();
  expect(result.start.missionControl.resume.checklist).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'resume-proof-2',
        kind: 'run_proof',
        command: 'projscan preflight --mode before_edit --format json',
        tool: 'projscan_preflight',
        args: { mode: 'before_edit' },
      }),
      expect.objectContaining({
        id: 'resume-proof-6',
        kind: 'run_proof',
        command: 'projscan handoff',
      }),
    ]),
  );
  const handoffChecklistProof = result.start.missionControl.resume.checklist?.find(
    (item) => item.id === 'resume-proof-6',
  );
  expect(handoffChecklistProof).not.toHaveProperty('tool');
  expect(handoffChecklistProof).not.toHaveProperty('args');
  expect(result.start.missionControl.handoff.readyProof.items).toEqual(
    result.start.missionControl.resume.remainingProofItems,
  );
  expect(
    result.start.missionControl.handoff.readyProof.toolCalls?.map((call) => call.command),
  ).not.toContain('projscan handoff');
  expect(result.start.missionControl.runbook.markdown).toContain('Proof queue:');
  expect(result.start.missionControl.runbook.markdown).toContain(
    '- [ready] run_proof proof-6: projscan handoff (CLI only)',
  );
  expect(result.start.missionControl.runbook.markdown).toContain(
    '- proof-2: `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.start.missionControl.runbook.markdown).toContain(
    '- proof-6: `projscan handoff` (CLI only)',
  );
});

test('projscan_start returns alternative routes for mixed intents', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    {
      intent: 'is it safe to commit and what breaks if I rename the auth token loader',
    },
    tmp,
  )) as { start: StartReport };

  expect(result.start.missionControl.routedIntent?.tool).toBe('projscan_impact');
  expect(result.start.mode).toBe('before_commit');
  expect(result.start.modeSource).toBe('intent');
  expect(result.start.missionControl.alternatives?.map((route) => route.tool)).toContain(
    'projscan_preflight',
  );
  expect(result.start.missionControl.alternatives?.[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
    }),
  );
});
