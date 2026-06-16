import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-understand-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module', exports: './src/server.ts' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src', 'db.ts'),
    'export async function query(sql: string) { return sql; }\n',
  );
  await fs.writeFile(
    path.join(tmp, 'src', 'config.ts'),
    'export function loadConfig() { return process.env.API_KEY; }\n',
  );
  await fs.writeFile(
    path.join(tmp, 'src', 'server.ts'),
    'import { query } from "./db"; import { loadConfig } from "./config"; export function createApp() { return query(String(loadConfig())); }\n',
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('understand renders repo map JSON', async () => {
  const result = await runCli(['understand', '--view', 'map', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.view).toBe('map');
  expect(report.claims.every((claim: { citations: unknown[] }) => claim.citations.length > 0)).toBe(
    true,
  );
  expect(report.readFirst.length).toBeGreaterThan(0);
});

test('understand change view preserves intent and returns change commands', async () => {
  const result = await runCli([
    'understand',
    '--view',
    'change',
    '--intent',
    'rename auth client',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.view).toBe('change');
  expect(report.intent).toBe('rename auth client');
  expect(report.changeReadiness.verificationCommands).toContain(
    'projscan understand --view verify --format json',
  );
});

test('understand console shows claims read-first unknowns and commands', async () => {
  const result = await runCli(['understand', '--view', 'contracts', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Claims');
  expect(result.stdout).toContain('Read First');
  expect(result.stdout).toContain('Unknowns');
  expect(result.stdout).toContain('Next Commands');
});

test('understand rejects unsupported formats through shared matrix', async () => {
  const result = await runCli(['understand', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan understand does not support --format sarif');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
