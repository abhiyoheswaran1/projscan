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
    expect.arrayContaining([
      'before_edit',
      'bug_hunt',
      'release_approval',
      'handoff',
      'pre_merge',
      'team_bootstrap',
      'pr_automation',
    ]),
  );
  expect(payload.recipes[0].commands).toContain('projscan preflight --mode before_edit --format json');
  expect(payload.recipes.find((recipe: { id: string }) => recipe.id === 'bug_hunt').mcpTools).toContain(
    'projscan_bug_hunt',
  );
  expect(payload.recipes.find((recipe: { id: string }) => recipe.id === 'team_bootstrap').commands).toContain(
    'projscan init github-action',
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


test('init policy writes a team policy starter as JSON', async () => {
  const result = await runCli(['init', 'policy', '--team', 'security', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.created).toBe(true);
  expect(payload.team).toBe('security');
  expect(payload.config.minScore).toBeGreaterThanOrEqual(85);
  expect(payload.nextCommands).toContain('projscan preflight --mode before_edit --format json');

  const config = JSON.parse(await fs.readFile(path.join(tmp, '.projscanrc.json'), 'utf-8'));
  expect(config.taint.sinks).toEqual(expect.arrayContaining(['exec', 'eval']));
});

test('init policy refuses to overwrite without force', async () => {
  await runCli(['init', 'policy', '--team', 'frontend', '--format', 'json', '--quiet']);
  const result = await runCli(['init', 'policy', '--team', 'platform', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.created).toBe(false);
  expect(payload.reason).toContain('already exists');
  const config = JSON.parse(await fs.readFile(path.join(tmp, '.projscanrc.json'), 'utf-8'));
  expect(config.ignore).toEqual(expect.arrayContaining(['.next', 'dist']));
});


test('init github-action writes a PR workflow as JSON', async () => {
  const result = await runCli(['init', 'github-action', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.created).toBe(true);
  expect(payload.target).toContain('.github/workflows/projscan.yml');
  expect(payload.nextCommands).toContain('git add .github/workflows/projscan.yml');
  const workflow = await fs.readFile(path.join(tmp, '.github', 'workflows', 'projscan.yml'), 'utf-8');
  expect(workflow).toContain('npx -y projscan start --mode before_merge --format json');
  expect(workflow).toContain('Enforce preflight verdict');
  expect(workflow).toContain("r.verdict === 'block'");
  expect(workflow).toContain('npx -y projscan evidence-pack --pr-comment');
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
