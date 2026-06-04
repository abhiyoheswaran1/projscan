import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

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
    'projscan init team --team platform',
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
  expect(payload.firstTenMinutes.commands.map((step: { command: string }) => step.command).slice(0, 3)).toEqual([
    'projscan privacy-check --offline',
    'projscan start --mode before_edit',
    'projscan preflight --mode before_edit --format json',
  ]);
  expect(payload.nextCommands).toEqual(
    expect.arrayContaining(['projscan privacy-check --offline', 'projscan init mcp --client all', 'projscan recipes']),
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

test('init team bootstraps policy workflow ownership baseline and start report', async () => {
  const result = await runCli(['init', 'team', '--team', 'security', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.team.team).toBe('security');
  expect(payload.team.created.policy).toBe(true);
  expect(payload.team.created.githubAction).toBe(true);
  expect(payload.team.created.codeowners).toBe(true);
  expect(payload.team.created.baseline).toBe(true);
  expect(payload.team.onboarding.map((step: { id: string }) => step.id)).toEqual(
    expect.arrayContaining(['verify-mcp-setup', 'open-first-pr']),
  );
  expect(payload.team.onboarding.find((step: { id: string }) => step.id === 'open-first-pr').command).toContain(
    'projscan evidence-pack --pr-comment',
  );
  expect(payload.start.schemaVersion).toBe(1);
  await expect(fs.access(path.join(tmp, '.projscan-baseline.json'))).resolves.toBeUndefined();
  await expect(fs.access(path.join(tmp, '.github', 'CODEOWNERS'))).resolves.toBeUndefined();
});

test('mcp doctor verifies setup with paste-ready config', async () => {
  const result = await runCli(['mcp', 'doctor', '--client', 'codex', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  expect(payload.client).toBe('codex');
  expect(payload.status).toBe('pass');
  expect(payload.expected.command).toBe('npx -y projscan mcp');
  expect(payload.configText).toContain('[mcp_servers.projscan]');
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
  expect(workflow).toContain('Validate PR comment');
});

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}
