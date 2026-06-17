import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { extractNextCommands, runStartCli } from '../helpers/startCli.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
});

test('start console shows the full first-ten-minutes path and coordination hints', async () => {
  const result = await runCli(['start', '--intent', 'is it safe to commit this change', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Start: before_commit');
  expect(result.stdout).toContain('Mode: inferred from intent');
  expect(result.stdout).toContain('Workflow: Pre-Merge');
  expect(result.stdout).toContain('Mission Control');
  expect(result.stdout).toContain('is it safe to commit this change');
  expect(result.stdout).toContain(
    'Route: Safety gate via projscan_preflight (confidence: high; matched: safe, commit)',
  );
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  expect(result.stdout).toContain('Done When');
  expect(result.stdout).toContain(
    '- projscan preflight --mode before_commit returns proceed or only documented manual-review items.',
  );
  expect(result.stdout).toContain('First 10 Minutes');
  expect(result.stdout).toContain('projscan privacy-check --offline');
  expect(result.stdout).toContain('projscan start --mode before_commit');
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  expect(result.stdout).toContain('projscan evidence-pack --pr-comment');
  expect(result.stdout).toContain(
    'projscan dogfood --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json',
  );
  expect(result.stdout).toContain('Coordination Hints');
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  const nextCommands = extractNextCommands(result.stdout);
  expect(nextCommands).toEqual([...new Set(nextCommands)]);
  expect(
    nextCommands.filter(
      (command) => command === 'projscan preflight --mode before_commit --format json',
    ),
  ).toHaveLength(1);
});

test('start console surfaces AgentLoop harness guidance when present', async () => {
  await fs.writeFile(
    path.join(tmp, 'AGENTLOOP.md'),
    '# AgentLoopKit\n\nUse npm exec agentloop -- status.\n',
  );

  const result = await runCli(['start', '--mode', 'before_edit', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Coordination Hints');
  expect(result.stdout).toContain(
    'Start with the AgentLoop task contract: npm exec agentloop -- status',
  );
});

test('start console surfaces AgentFlight verification guidance when present', async () => {
  await fs.mkdir(path.join(tmp, '.agentflight'), { recursive: true });
  await fs.writeFile(path.join(tmp, '.agentflight', 'config.json'), '{"version":1}\n');

  const result = await runCli(['start', '--mode', 'before_edit', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Coordination Hints');
  expect(result.stdout).toContain(
    'Run AgentFlight verification evidence: npm exec agentflight -- verify',
  );
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
