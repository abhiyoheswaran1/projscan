import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-assess-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        type: 'module',
        devDependencies: { vitest: '^3.0.0' },
        eslintConfig: { root: true },
        prettier: {},
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(
    path.join(tmp, 'README.md'),
    '# fixture\n\nA fixture project with enough usage and verification notes for assessment.\n',
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await fs.writeFile(path.join(tmp, 'src', 'index.test.ts'), 'export const ok = true;\n');
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('assess renders proof-first JSON', async () => {
  const result = await runCli([
    'assess',
    '--goal',
    'make this repo safer to ship this week',
    '--feedback',
    path.join(tmp, '.projscan-feedback.json'),
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.goal).toBe('make this repo safer to ship this week');
  expect(report.answers.shipNow).toMatch(/preflight|proof commands/i);
  expect(Array.isArray(report.proofCards)).toBe(true);
  expect(report.proofCards[0]?.trustMemory.status).toBe('none');
  expect(report.commands).toContain('projscan assess --mode fix-first --format json');
});

test('assess fix-first renders markdown proof cards', async () => {
  const result = await runCli(['assess', '--mode', 'fix-first', '--format', 'markdown', '--quiet']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('# Projscan Assess');
  expect(result.stdout).toContain('## Proof Cards');
  expect(result.stdout).toContain('**Evidence strength:**');
  expect(result.stdout).toContain('**Confidence reason:**');
  expect(result.stdout).toContain('**Ranking:**');
  expect(result.stdout).toContain('**Trust memory:**');
  expect(result.stdout).toContain('AgentLoopKit Handoff');
  expect(result.stdout).toContain('Do not release, publish, deploy, push, merge, tag, or bump versions');
  expect(result.stdout).toContain('## Verification');
});

test('assess rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['assess', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan assess does not support --format sarif');
});

test('assess emits the default Baseframe assessment artifact path', async () => {
  const taskId = 'auth-password-reset-20260626-01';
  const result = await runCli([
    'assess',
    '--intent',
    'Implement password reset',
    '--task-id',
    taskId,
    '--emit-baseframe',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim()).toBe(
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );

  const assessmentPath = path.join(
    tmp,
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
  const assessment = JSON.parse(await fs.readFile(assessmentPath, 'utf-8'));
  expect(assessment.schemaVersion).toBe('1.0');
  expect(assessment.kind).toBe('projscan-assessment');
  expect(assessment.taskId).toBe(taskId);
  expect(assessment.intent).toBe('Implement password reset');

  const manifest = JSON.parse(
    await fs.readFile(path.join(tmp, '.baseframe/agent-workflow.json'), 'utf-8'),
  );
  expect(manifest.tools.projscan.assessmentPath).toBe(
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
});

test('assess emits Baseframe assessment to an explicit output path', async () => {
  const outputPath = path.join(
    tmp,
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
  const result = await runCli([
    'assess',
    '--intent',
    'Implement password reset',
    '--task-id',
    'auth-password-reset-20260626-01',
    '--output',
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toBe(
    '.baseframe/evidence/auth-password-reset-20260626-01/projscan-assessment.json',
  );
  const assessment = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
  expect(assessment.taskId).toBe('auth-password-reset-20260626-01');
});

test('assess rejects invalid Baseframe task IDs', async () => {
  const result = await runCli([
    'assess',
    '--intent',
    'Implement password reset',
    '--task-id',
    '../agentloopkit-task',
    '--emit-baseframe',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toMatch(/task ID/i);
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, maxBuffer: 4 * 1024 * 1024 });
}
