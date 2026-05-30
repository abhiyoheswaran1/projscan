import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import {
  computeFirstRunDiagnostics,
  computeMcpSetupDoctor,
  getGithubActionStarter,
  getPolicyStarterKit,
  getWorkflowRecipes,
  writeGithubActionStarter,
  writePolicyStarterKit,
  writeTeamStarterKit,
} from '../../src/core/adoption.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');

test('first-run diagnostics recognize the built Tree-sitter runtime', async () => {
  const report = await computeFirstRunDiagnostics(repoRoot);
  const treeSitter = report.diagnostics.find((diagnostic) => diagnostic.id === 'tree-sitter');

  expect(treeSitter?.status).toBe('pass');
});

test('policy starter kits expose team-specific projscan config', () => {
  const security = getPolicyStarterKit('security');
  const monorepo = getPolicyStarterKit('monorepo');

  expect(security.team).toBe('security');
  expect(security.config.minScore).toBeGreaterThanOrEqual(85);
  expect(security.config.taint?.sinks).toEqual(expect.arrayContaining(['exec', 'eval']));
  expect(security.nextCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(monorepo.config.monorepo?.importPolicy?.[0]).toEqual(
    expect.objectContaining({ from: '*', allow: ['*'] }),
  );
});

test('policy starter writes config once and refuses accidental overwrite', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-policy-'));
  try {
    const created = await writePolicyStarterKit(root, 'frontend', { force: false });
    const refused = await writePolicyStarterKit(root, 'security', { force: false });

    expect(created.created).toBe(true);
    expect(refused.created).toBe(false);
    expect(refused.reason).toContain('already exists');
    const config = JSON.parse(await fs.readFile(path.join(root, '.projscanrc.json'), 'utf-8'));
    expect(config.ignore).toEqual(expect.arrayContaining(['.next', 'dist']));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GitHub Action starter wires PR comments to projscan evidence', () => {
  const starter = getGithubActionStarter();

  expect(starter.workflow).toContain('pull-requests: write');
  expect(starter.workflow).toContain('npx -y projscan start --mode before_merge --format json');
  expect(starter.workflow).toContain('Enforce preflight verdict');
  expect(starter.workflow).toContain("r.verdict === 'block'");
  expect(starter.workflow).toContain('npx -y projscan evidence-pack --pr-comment');
  expect(starter.workflow).toContain('Validate PR comment');
  expect(starter.workflow).toContain('Trust Calibration');
  expect(starter.workflow).toContain('Suggested Next Actions');
  expect(starter.workflow).toContain('actionable command');
  expect(starter.nextCommands).toContain('git add .github/workflows/projscan.yml');
});

test('GitHub Action PR comment validator runs in a real shell', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-action-validator-'));
  try {
    const script = extractWorkflowRunScript(getGithubActionStarter().workflow, 'Validate PR comment');
    expect(script).toContain("node <<'NODE'");
    expect(script).not.toContain('`(?:projscan');

    await fs.writeFile(
      path.join(root, 'projscan-comment.md'),
      [
        '## projscan approval evidence',
        '### Verdict',
        '### Trust Calibration',
        '### Baseline Trend',
        '### Top Risks',
        '### First Fix',
        '### Team Routing',
        '### Verification',
        '- `projscan preflight --format json`',
        '### Next Commands',
        '- `npm test`',
        '### Suggested Next Actions',
        '- Run `projscan review --format json`',
        '',
      ].join('\n'),
    );
    await expect(execFileAsync('bash', ['-lc', script], { cwd: root })).resolves.toBeDefined();

    await fs.writeFile(path.join(root, 'projscan-comment.md'), '## projscan approval evidence\n');
    await expect(execFileAsync('bash', ['-lc', script], { cwd: root })).rejects.toMatchObject({ code: 1 });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('workflow recipes include team bootstrap and PR automation paths', () => {
  const catalog = getWorkflowRecipes();

  expect(catalog.recipes.map((recipe) => recipe.id)).toEqual(
    expect.arrayContaining(['team_bootstrap', 'pr_automation']),
  );
  expect(catalog.recipes.find((recipe) => recipe.id === 'team_bootstrap')?.commands).toEqual(
    expect.arrayContaining([
      'projscan init team --team platform',
      'projscan start --mode before_edit --format json',
      'projscan mcp doctor --client codex --format json',
    ]),
  );
  expect(catalog.recipes.find((recipe) => recipe.id === 'pr_automation')?.commands).toEqual(
    expect.arrayContaining([
      'projscan init github-action',
      'projscan preflight --mode before_merge --format json',
      'projscan evidence-pack --pr-comment',
    ]),
  );
});


test('team starter writes policy workflow codeowners and baseline once', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-team-'));
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');

    const created = await writeTeamStarterKit(root, 'security', { force: false });
    const refused = await writeTeamStarterKit(root, 'security', { force: false });

    expect(created.created.policy).toBe(true);
    expect(created.created.githubAction).toBe(true);
    expect(created.created.codeowners).toBe(true);
    expect(created.created.baseline).toBe(true);
    expect(created.nextCommands).toContain('projscan start --mode before_edit --format json');
    expect(created.onboarding.map((step) => step.id)).toEqual(
      expect.arrayContaining(['review-generated-files', 'verify-mcp-setup', 'open-first-pr', 'tune-after-baseline']),
    );
    expect(created.onboarding.find((step) => step.id === 'open-first-pr')?.command).toContain('projscan evidence-pack --pr-comment');
    expect(refused.created.policy).toBe(false);
    await expect(fs.access(path.join(root, '.projscan-baseline.json'))).resolves.toBeUndefined();
    const codeowners = await fs.readFile(path.join(root, '.github', 'CODEOWNERS'), 'utf-8');
    expect(codeowners).toContain('@security-team');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('MCP setup doctor returns paste-ready config and checks', async () => {
  const report = await computeMcpSetupDoctor(repoRoot, 'codex');

  expect(report.schemaVersion).toBe(1);
  expect(report.client).toBe('codex');
  expect(report.status).toBe('pass');
  expect(report.expected.command).toBe('npx -y projscan mcp');
  expect(report.configText).toContain('[mcp_servers.projscan]');
  expect(report.checks.map((check) => check.id)).toEqual(
    expect.arrayContaining(['node', 'server-command', 'config-shape']),
  );
});

test('GitHub Action starter writes once and refuses accidental overwrite', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-action-'));
  try {
    const created = await writeGithubActionStarter(root, { force: false });
    const refused = await writeGithubActionStarter(root, { force: false });

    expect(created.created).toBe(true);
    expect(refused.created).toBe(false);
    expect(refused.reason).toContain('already exists');
    const workflow = await fs.readFile(path.join(root, '.github', 'workflows', 'projscan.yml'), 'utf-8');
    expect(workflow).toContain('Enforce preflight verdict');
    expect(workflow).toContain("r.verdict === 'block'");
    expect(workflow).toContain('npx -y projscan evidence-pack --pr-comment');
    expect(workflow).toContain('Validate PR comment');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

function extractWorkflowRunScript(workflow: string, stepName: string): string {
  const lines = workflow.split('\n');
  const stepIndex = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  expect(stepIndex).toBeGreaterThanOrEqual(0);
  const runIndex = lines.findIndex((line, index) => index > stepIndex && line.trim() === 'run: |');
  expect(runIndex).toBeGreaterThan(stepIndex);
  const out: string[] = [];
  for (const line of lines.slice(runIndex + 1)) {
    if (line.startsWith('      - name:')) break;
    out.push(line.startsWith('          ') ? line.slice(10) : line);
  }
  return out.join('\n');
}