import { beforeEach, expect, test } from 'vitest';
import { makeTempProject } from '../helpers/startProject.js';
import { runFuzzyImpactStart } from './startFuzzyImpactHelper.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
});

test('projscan_start mirrors fuzzy-impact proof into handoff and task card payloads', async () => {
  const start = await runFuzzyImpactStart(tmp);

  expect(start.missionControl.handoffPrompt).toContain(
    start.missionControl.resume.prompt,
  );
  expect(start.missionControl.handoffPrompt).toContain(
    'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
  );
  expect(start.missionControl.handoffPrompt).toContain(
    'Done when: An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(start.missionControl.handoffPrompt).toContain(
    'Review gate: Stop after the current Mission Control checklist and proof are complete.',
  );
  expect(start.missionControl.handoffPrompt).toContain(
    'Reviewer replies: Approve next slice => Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
  );
  const handoffReadyProof =
    start.missionControl.handoffPrompt.split('Ready proof: ')[1] ?? '';
  expect(handoffReadyProof).not.toContain('projscan search "auth token loader" --format json');
  expect(handoffReadyProof).toContain('projscan preflight --mode before_edit --format json');
  expect(start.missionControl.handoffPrompt).not.toContain('Next:');
  expect(start.missionControl.handoff.currentStep).toEqual(
    start.missionControl.executionPlan.cursor,
  );
  expect(start.missionControl.handoff.resume).toEqual(start.missionControl.resume);
  expect(start.missionControl.runbook.resume.toolCall).toEqual(
    start.missionControl.resume.toolCall,
  );
  expect(start.missionControl.runbook.resume.followUps).toEqual(
    start.missionControl.resume.followUps,
  );
  expect(start.missionControl.runbook.resume.inputBindings).toEqual(
    start.missionControl.resume.inputBindings,
  );
  expect(start.missionControl.runbook.resume.checklist).toEqual(
    start.missionControl.resume.checklist,
  );
  expect(start.missionControl.runbook.resume.remainingProofCommands).toEqual(
    start.missionControl.resume.remainingProofCommands,
  );
  expect(start.missionControl.runbook.resume.remainingProofToolCalls).toEqual(
    start.missionControl.resume.remainingProofToolCalls,
  );
  expect(start.missionControl.handoff.readyActions).toEqual(
    start.missionControl.readyActions,
  );
  expect(start.missionControl.handoff.needsInput).toEqual(
    start.missionControl.unresolvedInputs,
  );
  expect(
    start.missionControl.handoff.readyProof.commands.some((command) =>
      command.includes('<'),
    ),
  ).toBe(false);
  expect(start.missionControl.handoff.readyProof.commands).toEqual(
    start.missionControl.resume.remainingProofCommands,
  );
  expect(start.missionControl.handoff.readyProof.commands).not.toContain(
    'projscan search "auth token loader" --format json',
  );
  expect(start.missionControl.handoff.readyProof.toolCalls).toEqual(
    start.missionControl.resume.remainingProofToolCalls,
  );
  expect(
    start.missionControl.handoff.readyProof.toolCalls?.map((call) => call.tool),
  ).not.toContain('projscan_search');
  expect(start.missionControl.taskCard.markdown).toContain('# Mission Task Card');
  expect(start.missionControl.taskCard.markdown).toContain(
    'After inputs, run `projscan impact --symbol <symbol-from-search> --format json`',
  );
  expect(start.missionControl.taskCard.currentStep).toEqual(
    start.missionControl.executionPlan.cursor,
  );
});
