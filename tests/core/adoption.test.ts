import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  computeFirstRunDiagnostics,
  getGithubActionStarter,
  getPolicyStarterKit,
  getWorkflowRecipes,
  writeGithubActionStarter,
  writePolicyStarterKit,
} from '../../src/core/adoption.js';

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
  expect(starter.nextCommands).toContain('git add .github/workflows/projscan.yml');
});

test('workflow recipes include team bootstrap and PR automation paths', () => {
  const catalog = getWorkflowRecipes();

  expect(catalog.recipes.map((recipe) => recipe.id)).toEqual(
    expect.arrayContaining(['team_bootstrap', 'pr_automation']),
  );
  expect(catalog.recipes.find((recipe) => recipe.id === 'team_bootstrap')?.commands).toEqual(
    expect.arrayContaining([
      'projscan init policy --team platform',
      'projscan init github-action',
      'projscan start --mode before_edit --format json',
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
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
