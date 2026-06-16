import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import {
  detectStartHarnessHints,
  prioritizeStartHarnessHints,
} from '../../src/core/startHarness.js';
import type { SessionCoordinationHint } from '../../src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('detects AgentLoop and AgentFlight start harness hints from repo-local files', async () => {
  const root = await makeTempRoot();
  await fs.writeFile(path.join(root, 'AGENTLOOP.md'), '# AgentLoopKit\n');
  await fs.mkdir(path.join(root, '.agentflight'), { recursive: true });
  await fs.writeFile(path.join(root, '.agentflight', 'config.json'), '{"version":1}\n');

  const hints = await detectStartHarnessHints(root);

  expect(hints).toEqual([
    expect.objectContaining({
      id: 'agentloop-task-contract',
      label: 'Start with the AgentLoop task contract',
      command: 'npm exec agentloop -- status',
    }),
    expect.objectContaining({
      id: 'agentflight-verification',
      label: 'Run AgentFlight verification evidence',
      command: 'npm exec agentflight -- verify',
    }),
  ]);
});

test('detects AgentLoop config-only harnesses', async () => {
  const root = await makeTempRoot();
  await fs.writeFile(path.join(root, 'agentloop.config.json'), '{"version":1}\n');

  const hints = await detectStartHarnessHints(root);

  expect(hints).toHaveLength(1);
  expect(hints[0]).toEqual(
    expect.objectContaining({
      id: 'agentloop-task-contract',
      command: 'npm exec agentloop -- status',
    }),
  );
  expect(hints[0]?.message).toContain('agentloop.config.json');
});

test('returns no harness hints when repo-local harness files are absent', async () => {
  const root = await makeTempRoot();

  await expect(detectStartHarnessHints(root)).resolves.toEqual([]);
});

test('prioritizes harness proof hints ahead of generic coordination hints', () => {
  const hints: SessionCoordinationHint[] = [
    hint('current-worktree-check', 'projscan preflight --mode before_edit --format json'),
    hint('agentloop-task-contract', 'npm exec agentloop -- status'),
    hint('agentflight-verification', 'npm exec agentflight -- verify'),
    hint('remembered-session-context', 'projscan session touched --format json'),
  ];

  expect(prioritizeStartHarnessHints(hints).map((entry) => entry.id)).toEqual([
    'agentloop-task-contract',
    'agentflight-verification',
    'current-worktree-check',
  ]);
});

function hint(id: SessionCoordinationHint['id'], command: string): SessionCoordinationHint {
  return {
    id,
    label: id,
    message: id,
    command,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-start-harness-'));
  tempRoots.push(root);
  return root;
}
