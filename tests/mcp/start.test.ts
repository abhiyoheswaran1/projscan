import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-start-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

type TestResumeInputBinding = {
  inputId: string;
  label: string;
  placeholder: string;
  instruction: string;
  followUpIds: string[];
};

type TestResumeChecklistItem = {
  id: string;
  kind: string;
  phaseId: string;
  stepId: string;
  status: string;
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
  placeholder?: string;
  instruction?: string;
  blockedBy?: string[];
  dependsOn?: string[];
  unlocks?: string[];
  followUpIds?: string[];
};

type TestResumeProofToolCall = {
  stepId: string;
  command: string;
  tool: string;
  args?: Record<string, unknown>;
};

type TestResumeProofItem = {
  stepId: string;
  status: string;
  label: string;
  command: string;
  toolCall?: { tool: string; args?: Record<string, unknown> };
};

test('lists projscan_start as an MCP tool', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_start');

  expect(tool).toBeDefined();
  expect(tool?.inputSchema.properties).toEqual(
    expect.objectContaining({
      mode: expect.objectContaining({ enum: expect.arrayContaining(['before_edit', 'bug_hunt', 'release']) }),
      intent: expect.objectContaining({ type: 'string' }),
      include_handoff: expect.objectContaining({ type: 'boolean' }),
      max_tokens: expect.objectContaining({ type: 'number' }),
    }),
  );
});

test('projscan_start returns first-run guidance and next actions', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.({
    mode: 'release',
    max_tasks: 2,
    include_handoff: true,
    intent: 'prepare this branch for release',
  }, tmp)) as {
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
        routedIntent?: { tool: string; cli: string; confidence: string; matchedKeywords: string[]; score: number };
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
  expect(result.start.recommendedWorkflow.commands).toContain('projscan release-train --format json');
  expect(result.start.missionControl.intent).toBe('prepare this branch for release');
  expect(result.start.missionControl.routedIntent?.tool).toBe('projscan_release_train');
  expect(result.start.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      confidence: 'high',
      matchedKeywords: ['release', 'prepare'],
      score: 2,
    }),
  );
  expect(result.start.missionControl.primaryAction.command).toBe('projscan release-train --format json');
  expect(result.start.missionControl.primaryAction.args).toEqual({});
  expect(result.start.missionControl.actionPlan[0]?.command).toBe('projscan release-train --format json');
  expect(result.start.missionControl.actionPlan[0]?.args).toEqual({});
  expect(result.start.missionControl.readyActions[0]).toEqual(
    expect.objectContaining({
      command: 'projscan release-train --format json',
      tool: 'projscan_release_train',
      args: {},
    }),
  );
  expect(result.start.missionControl.successCriteria).toContain('Release train readiness has no blockers before packaging or publishing continues.');
  expect(result.start.missionControl.proofCommands).toContain('projscan preflight --mode before_merge --format json');
  expect(result.start.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
  expect(result.start.nextActions.length).toBeGreaterThan(0);
  expect(result.start.handoff?.next.length).toBeGreaterThan(0);
});

test('projscan_start infers mode from safety-gate intent when no mode is supplied', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.({
    intent: 'is it safe to commit this change',
  }, tmp)) as {
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
  expect(result.start.recommendedWorkflow.id).toBe('pre_merge');
  expect(result.start.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_commit' },
    }),
  );
  expect(result.start.missionControl.proofCommands).not.toContain('projscan preflight --mode before_edit --format json');
  expect(result.start.missionControl.successCriteria).toContain('projscan preflight --mode before_commit returns proceed or only documented manual-review items.');
});

test('projscan_start returns MCP-callable args for fuzzy impact intents', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.({
    intent: 'what breaks if I rename the auth token loader',
  }, tmp)) as {
    start: {
      missionControl: {
        successCriteria: string[];
        proofSummary: string;
        unresolvedInputs: Array<{ name: string; placeholder: string; sourceAction: string; instruction: string }>;
        actionPlan: Array<{ tool?: string; args?: Record<string, unknown>; command?: string }>;
        readyActions: Array<{ tool?: string; args?: Record<string, unknown>; command?: string }>;
        resume: {
          currentStep: {
            phaseId: string;
            stepId: string;
            kind: string;
            status: string;
            label: string;
            command?: string;
            instruction?: string;
            blockedBy?: string[];
            unlocks?: string[];
            reason: string;
          };
          status: string;
          instruction: string;
          prompt: string;
          commandBlock?: string;
          toolCall?: { tool: string; args?: Record<string, unknown> };
          followUps?: Array<{
            id: string;
            phaseId: string;
            kind: string;
            status: string;
            label: string;
            command?: string;
            tool?: string;
            args?: Record<string, unknown>;
            blockedBy?: string[];
            dependsOn?: string[];
          }>;
          inputBindings?: TestResumeInputBinding[];
          checklist?: TestResumeChecklistItem[];
          remainingProofCommands?: string[];
          remainingProofToolCalls?: TestResumeProofToolCall[];
          unlocks?: Array<{
            id: string;
            phaseId: string;
            kind: string;
            status: string;
            label: string;
            instruction?: string;
            command?: string;
          }>;
          blockedBy?: Array<{
            id: string;
            phaseId: string;
            kind: string;
            status: string;
            label: string;
            instruction?: string;
            command?: string;
          }>;
        };
        executionPlan: {
          summary: string;
          currentPhase: string;
          cursor: {
            phaseId: string;
            stepId: string;
            kind: string;
            status: string;
            label: string;
            command?: string;
            instruction?: string;
            blockedBy?: string[];
            unlocks?: string[];
            reason: string;
          };
          phases: Array<{
            id: string;
            status: string;
            steps: Array<{
              id: string;
              kind: string;
              status: string;
              label: string;
              command?: string;
              tool?: string;
              args?: Record<string, unknown>;
              instruction?: string;
              placeholder?: string;
              dependsOn?: string[];
              blockedBy?: string[];
              unlocks?: string[];
            }>;
          }>;
        };
        runbook: {
          title: string;
          status: string;
          currentPhase: string;
          currentStep: {
            phaseId: string;
            stepId: string;
            kind: string;
            status: string;
            label: string;
            command?: string;
            instruction?: string;
            blockedBy?: string[];
            unlocks?: string[];
            reason: string;
          };
          resume: {
            currentStep: {
              phaseId: string;
              stepId: string;
              kind: string;
              status: string;
              label: string;
              command?: string;
              instruction?: string;
              blockedBy?: string[];
              unlocks?: string[];
              reason: string;
            };
            status: string;
            instruction: string;
            prompt: string;
            commandBlock?: string;
            toolCall?: { tool: string; args?: Record<string, unknown> };
            followUps?: Array<{
              id: string;
              phaseId: string;
              kind: string;
              status: string;
              label: string;
              command?: string;
              tool?: string;
              args?: Record<string, unknown>;
              blockedBy?: string[];
              dependsOn?: string[];
            }>;
            inputBindings?: TestResumeInputBinding[];
            checklist?: TestResumeChecklistItem[];
            remainingProofCommands?: string[];
            remainingProofToolCalls?: TestResumeProofToolCall[];
            unlocks?: Array<{
              id: string;
              phaseId: string;
              kind: string;
              status: string;
              label: string;
              instruction?: string;
              command?: string;
            }>;
            blockedBy?: Array<{
              id: string;
              phaseId: string;
              kind: string;
              status: string;
              label: string;
              instruction?: string;
              command?: string;
            }>;
          };
          readyCommandBlock: string;
          blockedInputSummary?: string;
          markdown: string;
        };
        handoff: {
          currentStep: {
            phaseId: string;
            stepId: string;
            kind: string;
            status: string;
            label: string;
            command?: string;
            instruction?: string;
            blockedBy?: string[];
            unlocks?: string[];
            reason: string;
          };
          resume: {
            currentStep: {
              phaseId: string;
              stepId: string;
              kind: string;
              status: string;
              label: string;
              command?: string;
              instruction?: string;
              blockedBy?: string[];
              unlocks?: string[];
              reason: string;
            };
            status: string;
            instruction: string;
            prompt: string;
            commandBlock?: string;
            toolCall?: { tool: string; args?: Record<string, unknown> };
            followUps?: Array<{
              id: string;
              phaseId: string;
              kind: string;
              status: string;
              label: string;
              command?: string;
              tool?: string;
              args?: Record<string, unknown>;
              blockedBy?: string[];
              dependsOn?: string[];
            }>;
            inputBindings?: TestResumeInputBinding[];
            checklist?: TestResumeChecklistItem[];
            remainingProofCommands?: string[];
            remainingProofToolCalls?: TestResumeProofToolCall[];
            unlocks?: Array<{
              id: string;
              phaseId: string;
              kind: string;
              status: string;
              label: string;
              instruction?: string;
              command?: string;
            }>;
            blockedBy?: Array<{
              id: string;
              phaseId: string;
              kind: string;
              status: string;
              label: string;
              instruction?: string;
              command?: string;
            }>;
          };
          nextAction: { tool?: string; args?: Record<string, unknown>; command?: string };
          readyActions: Array<{ tool?: string; args?: Record<string, unknown>; command?: string }>;
          needsInput: Array<{ name: string; placeholder: string }>;
          doneWhen: string[];
          readyProof: { summary: string; commands: string[]; toolCalls?: TestResumeProofToolCall[] };
        };
      };
    };
  };

  expect(result.start.missionControl.actionPlan[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(result.start.missionControl.readyActions).toEqual([
    expect.objectContaining({
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  ]);
  expect(result.start.missionControl.actionPlan[1]).toEqual(
    expect.objectContaining({
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
    }),
  );
  expect(result.start.missionControl.actionPlan[2]).toEqual(
    expect.objectContaining({
      tool: 'projscan_impact',
      args: { file: '<file-from-search>' },
    }),
  );
  expect(result.start.missionControl.unresolvedInputs).toEqual([
    expect.objectContaining({
      name: 'symbol',
      placeholder: '<symbol-from-search>',
      sourceAction: 'Find exact target for impact analysis',
    }),
    expect.objectContaining({
      name: 'file',
      placeholder: '<file-from-search>',
      sourceAction: 'Find exact target for impact analysis',
    }),
  ]);
  expect(result.start.missionControl.proofSummary).toBe('Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.');
  expect(result.start.missionControl.successCriteria).toContain('An exact symbol or file path is selected from search results before impact analysis continues.');
  expect(result.start.missionControl.handoff.nextAction).toEqual(
    expect.objectContaining({
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(result.start.missionControl.resume).toEqual(
    expect.objectContaining({
      currentStep: result.start.missionControl.executionPlan.cursor,
      status: 'ready',
      commandBlock: 'projscan search "auth token loader" --format json',
      toolCall: {
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
      },
      instruction: 'Run projscan search "auth token loader" --format json.',
      prompt: 'Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).',
    }),
  );
  expect(result.start.missionControl.resume.unlocks).toEqual([
    expect.objectContaining({
      id: 'input-1',
      phaseId: 'resolve_inputs',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction: 'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
    expect.objectContaining({
      id: 'input-2',
      phaseId: 'resolve_inputs',
      label: 'file',
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
    }),
  ]);
  expect(result.start.missionControl.resume.inputBindings).toEqual([
    {
      inputId: 'input-1',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction: 'Replace <symbol-from-search> with an exported symbol returned by the search step.',
      followUpIds: ['follow-up-1'],
    },
    {
      inputId: 'input-2',
      label: 'file',
      placeholder: '<file-from-search>',
      instruction: 'Replace <file-from-search> with a file path returned by the search step.',
      followUpIds: ['follow-up-2'],
    },
  ]);
  const resumeChecklist = result.start.missionControl.resume.checklist ?? [];
  expect(resumeChecklist.slice(0, 5).map((item) => item.kind)).toEqual([
    'run_current',
    'resolve_input',
    'resolve_input',
    'run_follow_up',
    'run_follow_up',
  ]);
  expect(resumeChecklist[0]).toEqual(
    expect.objectContaining({
      id: 'resume-ready-1',
      kind: 'run_current',
      phaseId: 'ready_now',
      stepId: 'ready-1',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-input-1',
      kind: 'resolve_input',
      stepId: 'input-1',
      placeholder: '<symbol-from-search>',
      followUpIds: ['follow-up-1'],
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-follow-up-1',
      kind: 'run_follow_up',
      stepId: 'follow-up-1',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      blockedBy: ['input-1'],
    }),
  );
  expect(resumeChecklist).not.toContainEqual(
    expect.objectContaining({
      kind: 'run_proof',
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-proof-2',
      kind: 'run_proof',
      stepId: 'proof-2',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    }),
  );
  expect(resumeChecklist).toContainEqual(
    expect.objectContaining({
      id: 'resume-criterion-1',
      kind: 'confirm_done',
      stepId: 'criterion-1',
      label: 'An exact symbol or file path is selected from search results before impact analysis continues.',
    }),
  );
  expect(result.start.missionControl.proofCommands[0]).toBe('projscan search "auth token loader" --format json');
  expect(result.start.missionControl.resume.remainingProofCommands).toEqual([
    'projscan preflight --mode before_edit --format json',
    'projscan understand --view verify --format json',
    'projscan preflight --format json',
  ]);
  expect(result.start.missionControl.resume.remainingProofToolCalls).toEqual([
    {
      stepId: 'proof-2',
      command: 'projscan preflight --mode before_edit --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    },
    {
      stepId: 'proof-3',
      command: 'projscan understand --view verify --format json',
      tool: 'projscan_understand',
      args: { view: 'verify' },
    },
    {
      stepId: 'proof-4',
      command: 'projscan preflight --format json',
      tool: 'projscan_preflight',
      args: {},
    },
  ]);
  expect(result.start.missionControl.resume.remainingProofToolCalls?.map((call) => call.tool)).not.toContain('projscan_search');
  expect(result.start.missionControl.resume.followUps).toEqual([
    expect.objectContaining({
      id: 'follow-up-1',
      phaseId: 'follow_up',
      label: 'If search returns an exported symbol',
      command: 'projscan impact --symbol <symbol-from-search> --format json',
      tool: 'projscan_impact',
      args: { symbol: '<symbol-from-search>' },
      blockedBy: ['input-1'],
      dependsOn: ['ready-1', 'input-1'],
    }),
    expect.objectContaining({
      id: 'follow-up-2',
      phaseId: 'follow_up',
      label: 'If search returns a file path',
      command: 'projscan impact <file-from-search> --format json',
      tool: 'projscan_impact',
      args: { file: '<file-from-search>' },
      blockedBy: ['input-2'],
      dependsOn: ['ready-1', 'input-2'],
    }),
  ]);
  expect(result.start.missionControl.handoffPrompt).toContain(result.start.missionControl.resume.prompt);
  expect(result.start.missionControl.handoffPrompt).toContain('Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file).');
  expect(result.start.missionControl.handoffPrompt).toContain('Done when: An exact symbol or file path is selected from search results before impact analysis continues.');
  const handoffReadyProof = result.start.missionControl.handoffPrompt.split('Ready proof: ')[1] ?? '';
  expect(handoffReadyProof).not.toContain('projscan search "auth token loader" --format json');
  expect(handoffReadyProof).toContain('projscan preflight --mode before_edit --format json');
  expect(result.start.missionControl.handoffPrompt).not.toContain('Next:');
  expect(result.start.missionControl.handoff.currentStep).toEqual(result.start.missionControl.executionPlan.cursor);
  expect(result.start.missionControl.handoff.resume).toEqual(result.start.missionControl.resume);
  expect(result.start.missionControl.runbook.resume.toolCall).toEqual(result.start.missionControl.resume.toolCall);
  expect(result.start.missionControl.runbook.resume.followUps).toEqual(result.start.missionControl.resume.followUps);
  expect(result.start.missionControl.runbook.resume.inputBindings).toEqual(result.start.missionControl.resume.inputBindings);
  expect(result.start.missionControl.runbook.resume.checklist).toEqual(result.start.missionControl.resume.checklist);
  expect(result.start.missionControl.runbook.resume.remainingProofCommands).toEqual(result.start.missionControl.resume.remainingProofCommands);
  expect(result.start.missionControl.runbook.resume.remainingProofToolCalls).toEqual(result.start.missionControl.resume.remainingProofToolCalls);
  expect(result.start.missionControl.handoff.readyActions).toEqual(result.start.missionControl.readyActions);
  expect(result.start.missionControl.handoff.needsInput).toEqual(result.start.missionControl.unresolvedInputs);
  expect(result.start.missionControl.handoff.readyProof.commands.some((command) => command.includes('<'))).toBe(false);
  expect(result.start.missionControl.handoff.readyProof.commands).toEqual(result.start.missionControl.resume.remainingProofCommands);
  expect(result.start.missionControl.handoff.readyProof.commands).not.toContain('projscan search "auth token loader" --format json');
  expect(result.start.missionControl.handoff.readyProof.toolCalls).toEqual(result.start.missionControl.resume.remainingProofToolCalls);
  expect(result.start.missionControl.handoff.readyProof.toolCalls?.map((call) => call.tool)).not.toContain('projscan_search');
  expect(result.start.missionControl.executionPlan.summary).toBe(
    `Run 1 ready step, resolve 2 input(s), then gather ${result.start.missionControl.proofCommands.length} proof command(s).`,
  );
  expect(result.start.missionControl.executionPlan.currentPhase).toBe('ready_now');
  expect(result.start.missionControl.executionPlan.cursor).toEqual(
    expect.objectContaining({
      phaseId: 'ready_now',
      stepId: 'ready-1',
      kind: 'tool',
      status: 'ready',
      command: 'projscan search "auth token loader" --format json',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      unlocks: ['input-1', 'input-2'],
      reason: 'Run this ready command next; it can unlock later inputs or follow-up steps.',
    }),
  );
  expect(result.start.missionControl.executionPlan.phases.map((phase) => `${phase.id}:${phase.status}`)).toEqual([
    'next_action:ready',
    'ready_now:ready',
    'resolve_inputs:blocked',
    'follow_up:pending',
    'proof:ready',
    'done_when:pending',
  ]);
  expect(result.start.missionControl.executionPlan.phases[0]?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'tool',
      status: 'ready',
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
      command: 'projscan search "auth token loader" --format json',
    }),
  );
  expect(result.start.missionControl.executionPlan.phases.find((phase) => phase.id === 'resolve_inputs')?.steps[0]).toEqual(
    expect.objectContaining({
      kind: 'input',
      status: 'blocked',
      label: 'symbol',
      placeholder: '<symbol-from-search>',
      instruction: 'Replace <symbol-from-search> with an exported symbol returned by the search step.',
    }),
  );
  expect(result.start.missionControl.executionPlan.phases.find((phase) => phase.id === 'ready_now')?.steps[0]).toEqual(
    expect.objectContaining({
      id: 'ready-1',
      unlocks: ['input-1', 'input-2'],
    }),
  );
  expect(result.start.missionControl.executionPlan.phases.find((phase) => phase.id === 'follow_up')?.steps[0]).toEqual(
    expect.objectContaining({
      id: 'follow-up-1',
      dependsOn: ['ready-1', 'input-1'],
      blockedBy: ['input-1'],
    }),
  );
  expect(result.start.missionControl.runbook).toEqual(
    expect.objectContaining({
      title: 'Runbook: Find exact target for impact analysis',
      currentPhase: 'ready_now',
      currentStep: result.start.missionControl.executionPlan.cursor,
      resume: result.start.missionControl.resume,
      readyCommandBlock: 'projscan search "auth token loader" --format json',
      blockedInputSummary: 'Needs input: symbol=<symbol-from-search>, file=<file-from-search>.',
    }),
  );
  expect(result.start.missionControl.runbook.currentPhase).toBe(result.start.missionControl.executionPlan.cursor.phaseId);
  expect(result.start.missionControl.runbook.readyCommandBlock).not.toContain('<');
  expect(result.start.missionControl.runbook.markdown).toContain('## Current Cursor');
  expect(result.start.missionControl.runbook.markdown).toContain('- Step: ready-1 in ready_now');
  expect(result.start.missionControl.runbook.markdown).toContain('- MCP call: projscan_search {"query":"auth token loader"}');
  expect(result.start.missionControl.runbook.markdown).toContain('- Unlocks: input-1, input-2');
  expect(result.start.missionControl.runbook.markdown).toContain('## Resume');
  expect(result.start.missionControl.runbook.markdown).toContain('```sh\nprojscan search "auth token loader" --format json\n```');
  expect(result.start.missionControl.runbook.markdown).toContain('MCP call: projscan_search {"query":"auth token loader"}');
  expect(result.start.missionControl.runbook.markdown).toContain('- input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.start.missionControl.runbook.markdown).toContain('- input-2 (file): Replace <file-from-search> with a file path returned by the search step.');
  expect(result.start.missionControl.runbook.markdown).toContain('Template inputs:');
  expect(result.start.missionControl.runbook.markdown).toContain('- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.start.missionControl.runbook.markdown).toContain('- <file-from-search> -> input-2 (file): Replace <file-from-search> with a file path returned by the search step.');
  expect(result.start.missionControl.runbook.markdown).toContain('Resume checklist:');
  expect(result.start.missionControl.runbook.markdown).toContain('- [ready] run_current ready-1: projscan search "auth token loader" --format json');
  expect(result.start.missionControl.runbook.markdown).toContain('- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})');
  expect(result.start.missionControl.runbook.markdown).toContain('- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.');
  expect(result.start.missionControl.runbook.markdown).toContain('- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})');
  expect(result.start.missionControl.runbook.markdown).toContain('- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json');
  expect(result.start.missionControl.runbook.markdown).toContain('- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.start.missionControl.runbook.markdown).toContain('Remaining proof:');
  expect(result.start.missionControl.runbook.markdown).not.toContain('Remaining proof:\n- `projscan search "auth token loader" --format json`');
  expect(result.start.missionControl.runbook.markdown).toContain('MCP proof calls:');
  expect(result.start.missionControl.runbook.markdown).toContain('- proof-2: projscan_preflight {"mode":"before_edit"}');
  expect(result.start.missionControl.runbook.markdown).toContain('- proof-3: projscan_understand {"view":"verify"}');
  expect(result.start.missionControl.runbook.markdown).toContain('- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json');
  expect(result.start.missionControl.runbook.markdown).toContain('- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json');
  expect(result.start.missionControl.runbook.markdown).toContain('## Handoff Prompt');
  expect(result.start.missionControl.runbook.markdown).toContain(result.start.missionControl.handoffPrompt);
  expect(result.start.missionControl.runbook.markdown).toContain('## Ready Commands');
  expect(result.start.missionControl.runbook.markdown).toContain('- `projscan search "auth token loader" --format json`');
  expect(result.start.missionControl.runbook.markdown).toContain('## Blocked Inputs');
});

test('projscan_start exposes complete remaining proof items for handoff intents', async () => {
  const handler = getToolHandler('projscan_start');
  const { session } = await loadSession(tmp);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(tmp, session);

  const result = (await handler?.({
    intent: 'give the next agent a handoff',
  }, tmp)) as {
    start: {
      missionControl: {
        resume: {
          checklist?: TestResumeChecklistItem[];
          remainingProofCommands?: string[];
          remainingProofToolCalls?: TestResumeProofToolCall[];
          remainingProofItems?: TestResumeProofItem[];
        };
        handoff: {
          readyProof: {
            commands: string[];
            toolCalls?: TestResumeProofToolCall[];
            items?: TestResumeProofItem[];
          };
        };
        runbook: {
          markdown: string;
        };
      };
    };
  };

  expect(result.start.missionControl.resume.remainingProofCommands).toContain('projscan handoff');
  expect(result.start.missionControl.resume.remainingProofToolCalls?.map((call) => call.command)).not.toContain('projscan handoff');
  expect(result.start.missionControl.resume.remainingProofItems?.map((item) => item.command)).toEqual(
    result.start.missionControl.resume.remainingProofCommands,
  );
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
  expect(result.start.missionControl.resume.remainingProofItems?.find((item) => item.command === 'projscan handoff')?.toolCall).toBeUndefined();
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
  const handoffChecklistProof = result.start.missionControl.resume.checklist?.find((item) => item.id === 'resume-proof-6');
  expect(handoffChecklistProof).not.toHaveProperty('tool');
  expect(handoffChecklistProof).not.toHaveProperty('args');
  expect(result.start.missionControl.handoff.readyProof.items).toEqual(result.start.missionControl.resume.remainingProofItems);
  expect(result.start.missionControl.handoff.readyProof.toolCalls?.map((call) => call.command)).not.toContain('projscan handoff');
  expect(result.start.missionControl.runbook.markdown).toContain('Proof queue:');
  expect(result.start.missionControl.runbook.markdown).toContain('- [ready] run_proof proof-6: projscan handoff (CLI only)');
  expect(result.start.missionControl.runbook.markdown).toContain('- proof-2: `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})');
  expect(result.start.missionControl.runbook.markdown).toContain('- proof-6: `projscan handoff` (CLI only)');
});

test('projscan_start returns alternative routes for mixed intents', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.({
    intent: 'is it safe to commit and what breaks if I rename the auth token loader',
  }, tmp)) as {
    start: {
      mode: string;
      modeSource: string;
      missionControl: {
        routedIntent?: { tool: string };
        alternatives?: Array<{ tool: string; cli: string; intent: string }>;
      };
    };
  };

  expect(result.start.missionControl.routedIntent?.tool).toBe('projscan_impact');
  expect(result.start.mode).toBe('before_commit');
  expect(result.start.modeSource).toBe('intent');
  expect(result.start.missionControl.alternatives?.map((route) => route.tool)).toContain('projscan_preflight');
  expect(result.start.missionControl.alternatives?.[0]).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
    }),
  );
});
