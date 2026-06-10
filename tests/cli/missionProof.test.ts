import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-mission-proof-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await writeMission(tmp, '.projscan/mission', 'passed');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('mission-proof reports local Mission Control adoption evidence as JSON', async () => {
  const result = await runCli(['mission-proof', '--mission', '.projscan/mission', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.readOnly).toBe(true);
  expect(report.missionControl.totals.missions).toBe(1);
  expect(report.missionControl.totals.passed).toBe(1);
  expect(report.nextActions.map((action: { command?: string }) => action.command)).toContain('projscan start --mission .projscan/mission');
});

test('start --mission includes the saved mission outcome in console output', async () => {
  const result = await runCli(['start', '--mission', '.projscan/mission', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Mission Outcome');
  expect(result.stdout).toContain('Status: passed');
  expect(result.stdout).toContain('Mission proof passed after 2 command(s).');
  expect(result.stdout).toContain('Version candidate: review_candidate');
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}

async function writeMission(root: string, relativeDir: string, status: 'passed' | 'failed'): Promise<void> {
  const dir = path.join(root, relativeDir);
  const proof = path.join(dir, 'proof-logs');
  await fs.mkdir(proof, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      kind: 'projscan.mission-bundle',
      mode: 'before_edit',
      status: 'ready',
      currentStep: { phaseId: 'ready_now', stepId: 'ready-1', command: 'projscan search "auth" --format json' },
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'summary.json'),
    JSON.stringify({
      schemaVersion: 1,
      status,
      totalCommands: 2,
      nextAction: status === 'passed' ? 'run ./review.sh and choose a reviewer reply.' : 'inspect the failed log, fix the issue, then rerun ./mission.sh.',
    }) + '\n',
  );
  await fs.writeFile(
    path.join(proof, 'status.jsonl'),
    [
      JSON.stringify({ id: 'current-ready-1', label: 'Run current command', log: 'current-ready-1.log', command: 'projscan search "auth" --format json', exitCode: 0 }),
      JSON.stringify({ id: 'proof-1', label: 'Proof 1', log: 'proof-1.log', command: 'projscan preflight --mode before_edit --format json', exitCode: status === 'passed' ? 0 : 1 }),
    ].join('\n') + '\n',
  );
}
