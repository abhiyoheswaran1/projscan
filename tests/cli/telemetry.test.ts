import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;
let telemetryHome: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-telemetry-'));
  telemetryHome = path.join(tmp, 'telemetry-home');
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('telemetry status enable explain and disable are explicit JSON controls', async () => {
  const initial = await runCli(['telemetry', 'status', '--format', 'json', '--quiet']);
  expect(initial.exitCode).toBe(0);
  expect(JSON.parse(initial.stdout)).toMatchObject({ enabled: false, anonymousId: null, queueLength: 0 });

  const explain = await runCli(['telemetry', 'explain', '--format', 'json', '--quiet']);
  expect(explain.exitCode).toBe(0);
  const policy = JSON.parse(explain.stdout);
  expect(policy.default).toBe('off');
  expect(policy.collected).toContain('command_category');
  expect(policy.neverCollected).toContain('source_code');

  const enabled = await runCli(['telemetry', 'enable', '--format', 'json', '--quiet']);
  expect(enabled.exitCode).toBe(0);
  expect(JSON.parse(enabled.stdout)).toMatchObject({ enabled: true });

  const disabled = await runCli(['telemetry', 'disable', '--format', 'json', '--quiet']);
  expect(disabled.exitCode).toBe(0);
  expect(JSON.parse(disabled.stdout)).toMatchObject({ enabled: false, queueLength: 0 });
});

test('init team surfaces the telemetry opt-in choice without enabling it in JSON automation', async () => {
  const result = await runCli(['init', 'team', '--team', 'platform', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.team.onboarding.map((step: { id: string }) => step.id)).toContain('telemetry-opt-in');
  expect(payload.team.nextCommands).toContain('projscan telemetry explain');
  expect(payload.telemetry.status.enabled).toBe(false);

  const status = await runCli(['telemetry', 'status', '--format', 'json', '--quiet']);
  expect(JSON.parse(status.stdout).enabled).toBe(false);
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: tmp,
      env: { ...process.env, PROJSCAN_TELEMETRY_HOME: telemetryHome, PROJSCAN_TELEMETRY_NO_NETWORK: '1' },
      maxBuffer: 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}
