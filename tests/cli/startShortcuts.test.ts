import { expect, test } from 'vitest';
import {
  buildShortcutIndex,
  missionReviewReplyLines,
  missionShortcutOptions,
  readyProofCommands,
  readyToolCalls,
} from '../../src/cli/commands/startShortcuts.js';
import type { StartMissionToolCall, StartReport } from '../../src/types.js';

test('buildShortcutIndex preserves command order, labels, quoting, and current cursor fields', () => {
  const report = startReport({
    intent: "what breaks in Bob's token loader",
    mode: 'before_commit',
    modeSource: 'explicit',
  });

  const index = buildShortcutIndex(report, {
    mode: 'before_commit',
    intent: "what breaks in Bob's token loader",
  });

  expect(index).toMatchObject({
    schemaVersion: 1,
    kind: 'projscan.start-shortcuts',
    currentCommand: 'projscan search "auth token loader" --format json',
    currentToolCall: {
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    },
    baseCommand:
      "projscan start --mode 'before_commit' --intent 'what breaks in Bob'\\''s token loader'",
  });
  expect(index.shortcuts.map((entry) => entry.id)).toEqual([
    'next-command',
    'next-tool-call',
    'ready-tool-calls',
    'proof-commands',
    'checklist',
    'resume-json',
    'handoff-json',
    'mission-script',
    'save-mission',
    'task-card',
    'review-gate',
    'review-gate-json',
    'review-policy',
    'review-replies',
    'runbook',
    'handoff-prompt',
    'start',
  ]);
  expect(index.shortcuts[0]).toEqual({
    id: 'next-command',
    label: 'Current shell command',
    command:
      "projscan start --next-command --mode 'before_commit' --intent 'what breaks in Bob'\\''s token loader'",
    description: 'Print only the current Mission Control cursor command.',
  });
  expect(index.shortcuts.find((entry) => entry.id === 'save-mission')).toEqual({
    id: 'save-mission',
    label: 'Save mission bundle',
    command:
      "projscan start --save-mission .projscan/mission --mode 'before_commit' --intent 'what breaks in Bob'\\''s token loader'",
    description: 'Write the Mission Control bundle to .projscan/mission.',
  });
  expect(index.shortcuts.at(-1)).toEqual({
    id: 'start',
    label: 'Full start report',
    command:
      "projscan start --mode 'before_commit' --intent 'what breaks in Bob'\\''s token loader'",
    description: 'Print the full Mission Control start report.',
  });
});

test('missionShortcutOptions only includes explicit mode and mission intent', () => {
  expect(missionShortcutOptions(startReport({ mode: 'release', modeSource: 'explicit' }))).toEqual({
    mode: 'release',
    intent: 'what breaks if I rename the auth token loader',
  });
  expect(missionShortcutOptions(startReport({ mode: 'bug_hunt', modeSource: 'intent' }))).toEqual({
    intent: 'what breaks if I rename the auth token loader',
  });
});

test('readyToolCalls compacts and dedupes cursor and proof calls', () => {
  const proofCall = {
    tool: 'projscan_preflight',
    args: { mode: 'before_edit' },
    stepId: 'proof-2',
    command: 'projscan preflight --mode before_edit --format json',
  } as unknown as StartMissionToolCall;
  const report = startReport({
    readyProofToolCalls: [
      proofCall,
      proofCall,
      { tool: 'projscan_understand', args: { view: 'verify' } },
    ],
  });

  expect(readyToolCalls(report)).toEqual([
    {
      tool: 'projscan_search',
      args: { query: 'auth token loader' },
    },
    {
      tool: 'projscan_preflight',
      args: { mode: 'before_edit' },
    },
    {
      tool: 'projscan_understand',
      args: { view: 'verify' },
    },
  ]);
});

test('readyProofCommands prefers handoff ready proof and falls back to mission proof commands', () => {
  expect(readyProofCommands(startReport())).toEqual([
    'projscan preflight --mode before_edit --format json',
  ]);
  expect(readyProofCommands(startReport({ readyProofCommands: [] }))).toEqual([
    'projscan search "auth token loader" --format json',
    'projscan preflight --format json',
  ]);
});

test('missionReviewReplyLines formats copyable decision replies', () => {
  expect(missionReviewReplyLines(startReport())).toEqual([
    '- Approve next slice: Approved: start one more bounded implementation slice.',
    '- Request changes: Changes requested: address review feedback.',
  ]);
});

function startReport(
  overrides: {
    intent?: string;
    mode?: string;
    modeSource?: string;
    readyProofCommands?: string[];
    readyProofToolCalls?: StartMissionToolCall[];
  } = {},
): StartReport {
  return {
    mode: overrides.mode ?? 'before_edit',
    modeSource: overrides.modeSource ?? 'intent',
    missionControl: {
      intent: overrides.intent ?? 'what breaks if I rename the auth token loader',
      executionPlan: {
        cursor: {
          command: 'projscan search "auth token loader" --format json',
          tool: 'projscan_search',
          args: { query: 'auth token loader' },
        },
      },
      resume: {
        toolCall: {
          tool: 'projscan_search',
          args: { query: 'auth token loader' },
        },
      },
      handoff: {
        readyProof: {
          commands: overrides.readyProofCommands ?? [
            'projscan preflight --mode before_edit --format json',
          ],
          toolCalls: overrides.readyProofToolCalls ?? [],
        },
      },
      proofCommands: [
        'projscan search "auth token loader" --format json',
        'projscan preflight --format json',
      ],
      reviewGate: {
        decisions: [
          {
            label: 'Approve next slice',
            reply: 'Approved: start one more bounded implementation slice.',
          },
          {
            label: 'Request changes',
            reply: 'Changes requested: address review feedback.',
          },
        ],
      },
    },
  } as unknown as StartReport;
}
