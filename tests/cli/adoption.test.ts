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

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-adoption-'));
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

test('init mcp renders ready-to-paste client config as JSON', async () => {
  const result = await runCli(['init', 'mcp', '--client', 'claude-desktop', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.client).toBe('claude-desktop');
  expect(payload.config.mcpServers.projscan.command).toBe('npx');
  expect(payload.config.mcpServers.projscan.args).toEqual(['-y', 'projscan', 'mcp']);
  expect(payload.install.command).toBe('npm install -g projscan');
  expect(payload.whereToPaste).toContain('Claude');
});

test('recipes renders the adoption workflow catalog', async () => {
  const result = await runCli(['recipes', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.recipes.map((recipe: { id: string }) => recipe.id)).toEqual(
    expect.arrayContaining(['before_edit', 'bug_hunt', 'release_approval', 'handoff', 'pre_merge']),
  );
  expect(payload.recipes[0].commands).toContain('projscan preflight --mode before_edit --format json');
  expect(payload.recipes.find((recipe: { id: string }) => recipe.id === 'bug_hunt').mcpTools).toContain(
    'projscan_bug_hunt',
  );
});

test('first-run reports setup diagnostics without mutating the project', async () => {
  const result = await runCli(['first-run', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.schemaVersion).toBe(1);
  expect(payload.diagnostics.map((diagnostic: { id: string }) => diagnostic.id)).toEqual(
    expect.arrayContaining(['node', 'package-json', 'git', 'projscan-config', 'plugins', 'mcp-startup']),
  );
  expect(payload.nextCommands).toEqual(
    expect.arrayContaining(['projscan init mcp --client all', 'projscan recipes']),
  );

  await expect(fs.access(path.join(tmp, '.projscanrc.json'))).rejects.toThrow();
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: tmp,
      env: process.env,
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
