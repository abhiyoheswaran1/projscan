import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { startRiskSectionTitle } from '../../src/cli/commands/startConsole.js';
import type { StartReport } from '../../src/types/start.js';
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
  expect(result.stdout).toContain('Workflow: Before handoff or commit');
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
  expect(result.stdout).toContain('Adoption Follow-Up');
  const firstTenIndex = result.stdout.indexOf('First 10 Minutes');
  const adoptionFollowUpIndex = result.stdout.indexOf('Adoption Follow-Up');
  const coordinationHintsIndex = result.stdout.indexOf('Coordination Hints');
  expect(adoptionFollowUpIndex).toBeGreaterThan(firstTenIndex);
  expect(coordinationHintsIndex).toBeGreaterThan(adoptionFollowUpIndex);
  const firstTenSection = result.stdout.slice(firstTenIndex, adoptionFollowUpIndex);
  const adoptionFollowUpSection = result.stdout.slice(adoptionFollowUpIndex, coordinationHintsIndex);
  expect(result.stdout).toContain('projscan privacy-check --offline');
  expect(result.stdout).toContain('projscan start --mode before_commit');
  expect(result.stdout).toContain('projscan preflight --mode before_commit --format json');
  expect(result.stdout).toContain('projscan evidence-pack --pr-comment');
  expect(firstTenSection).not.toContain('Capture reviewer feedback');
  expect(firstTenSection).not.toContain('Run adoption proof');
  expect(adoptionFollowUpSection).toContain('Capture reviewer feedback');
  expect(adoptionFollowUpSection).toContain('Run adoption proof');
  expect(adoptionFollowUpSection).toContain(
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

test('start console omits duplicate action plan when ready actions match it', async () => {
  const result = await runCli(['start', '--intent', 'prepare this branch for handoff', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Start: before_commit');
  expect(result.stdout).toContain('Workflow: Before handoff or commit');
  expect(result.stdout).toContain('Mode: inferred from intent');
  expect(result.stdout).toContain('Ready Now');
  expect(result.stdout).toContain('projscan agent-brief --intent next_agent --format json');
  expect(result.stdout).not.toContain('\nAction Plan\n');
});

test('start console labels healthy p2-only risks as a watch list', () => {
  expect(
    startRiskSectionTitle(
      startReportForRiskTitle('healthy', [
        { priority: 'p2', title: 'Hotspot src/types.ts' },
        { priority: 'p2', title: 'Hotspot tests/cli/start.test.ts' },
      ]),
    ),
  ).toBe('Watch List');

  expect(
    startRiskSectionTitle(
      startReportForRiskTitle('healthy', [{ priority: 'p1', title: 'No test framework' }]),
    ),
  ).toBe('Top Risks');
  expect(
    startRiskSectionTitle(
      startReportForRiskTitle('needs_attention', [
        { priority: 'p2', title: 'Hotspot src/types.ts' },
      ]),
    ),
  ).toBe('Top Risks');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}

function startReportForRiskTitle(
  qualityVerdict: StartReport['evidence']['qualityVerdict'],
  topRisks: Array<Pick<StartReport['topRisks'][number], 'priority' | 'title'>>,
): StartReport {
  return {
    evidence: { qualityVerdict },
    topRisks,
  } as StartReport;
}
