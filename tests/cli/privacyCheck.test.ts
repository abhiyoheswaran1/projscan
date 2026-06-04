import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;
let telemetryHome: string;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-privacy-')));
  telemetryHome = path.join(tmp, 'telemetry-home');
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n');
  await fs.writeFile(path.join(tmp, '.env'), 'SECRET=local-only\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await execFileAsync('git', ['init', '-q'], { cwd: tmp });
  await execFileAsync('git', ['add', '.gitignore', 'package.json', 'src/index.ts'], { cwd: tmp });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('privacy-check reports the local trust boundary as JSON', async () => {
  const result = await runCli(['privacy-check', '--format', 'json', '--quiet'], { PROJSCAN_OFFLINE: '1' });

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.telemetry.enabled).toBe(false);
  expect(payload.offline.enabled).toBe(true);
  expect(payload.scan.rootPath).toBe(tmp);
  expect(payload.scan.gitignoreRespected).toBe(true);
  expect(payload.scan.includeIgnored).toBe(false);
  expect(payload.scan.ignoredFileCount).toBeGreaterThanOrEqual(1);
  expect(payload.envContentScanning).toBe(false);
  expect(payload.plugins).toEqual(
    expect.objectContaining({
      executionEnabled: false,
      envFlag: 'PROJSCAN_PLUGINS_PREVIEW',
      localCodeExecution: false,
    }),
  );
  expect(payload.localWrites.surfaces).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'graph cache', path: '.projscan-cache/graph.json' }),
      expect.objectContaining({ name: 'session memory', path: '.projscan-cache/session.json' }),
      expect.objectContaining({ name: 'project memory', path: '.projscan-memory/memory.json' }),
      expect.objectContaining({ name: 'baseline', path: '.projscan-baseline.json' }),
    ]),
  );
  expect(payload.reportExports).toEqual(
    expect.objectContaining({
      mayContainPaths: true,
      mayContainFindings: true,
      userControlled: true,
    }),
  );
  expect(payload.network.endpoints).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'telemetry', blockedByOffline: true }),
      expect.objectContaining({ name: 'npm registry', blockedByOffline: true }),
      expect.objectContaining({ name: 'npm audit', blockedByOffline: true }),
    ]),
  );
});

async function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, env: { ...process.env, PROJSCAN_TELEMETRY_HOME: telemetryHome, ...env } });
}
