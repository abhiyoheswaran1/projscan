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

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-prove-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        type: 'module',
        scripts: { test: 'vitest run' },
        devDependencies: { vitest: '^3.0.0' },
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/core'), { recursive: true });
  await fs.mkdir(path.join(tmp, 'tests/core'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings; }\n",
  );
  await fs.writeFile(
    path.join(tmp, 'tests/core/bugHunt.test.ts'),
    "test('builds report', () => undefined);\n",
  );
  await git(['init']);
  await git(['config', 'user.email', 'projscan@example.test']);
  await git(['config', 'user.name', 'Projscan Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'initial']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('prove intent renders JSON', async () => {
  const result = await runCli([
    'prove',
    '--intent',
    'split bugHunt.ts into ranking, evidence, and output modules',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('intent');
  expect(report.contract.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(report.contract.receiptCommand).toContain('projscan prove --changed');
});

test('prove changed reads a saved contract and renders markdown receipt', async () => {
  const save = await runCli([
    'prove',
    '--intent',
    'split bugHunt.ts into ranking, evidence, and output modules',
    '--save-contract',
    '.projscan/proof-contract.json',
    '--format',
    'json',
    '--quiet',
  ]);
  expect(save.exitCode).toBe(0);

  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings.map(String); }\n",
  );
  const changed = await runCli([
    'prove',
    '--changed',
    '--contract',
    '.projscan/proof-contract.json',
    '--format',
    'markdown',
    '--quiet',
  ]);

  expect(changed.exitCode).toBe(0);
  expect(changed.stdout).toContain('# Projscan Proof Receipt');
  expect(changed.stdout).toContain('src/core/bugHunt.ts');
  expect(changed.stdout).toContain('Proof Commands');
  expect(changed.stdout).toContain('Scope Decision');
  expect(changed.stdout).toContain('Allowed production');
  expect(changed.stdout).toContain('Expected tests');
  expect(changed.stdout).toContain('Reviewer Checklist');
  expect(changed.stdout).toContain('Copyable Decision');
});

test('prove records command evidence and replays it in markdown receipts', async () => {
  const save = await runCli([
    'prove',
    '--intent',
    'split bugHunt.ts into ranking, evidence, and output modules',
    '--save-contract',
    '.projscan/proof-contract.json',
    '--format',
    'json',
    '--quiet',
  ]);
  expect(save.exitCode).toBe(0);
  const contract = JSON.parse(save.stdout).contract;
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings.map(String); }\n",
  );

  for (const command of contract.proofCommands) {
    const recorded = await runCli([
      'prove',
      '--record-command',
      command,
      '--exit-code',
      '0',
      '--duration-ms',
      '123',
      '--summary',
      'proof passed',
      '--format',
      'json',
      '--quiet',
    ]);
    expect(recorded.exitCode).toBe(0);
    expect(JSON.parse(recorded.stdout).ledgerRecord.command).toBe(command);
  }

  const changed = await runCli([
    'prove',
    '--changed',
    '--contract',
    '.projscan/proof-contract.json',
    '--format',
    'markdown',
    '--quiet',
  ]);

  expect(changed.exitCode).toBe(0);
  expect(changed.stdout).toContain('## Proof Replay');
  expect(changed.stdout).toContain('- **Proof status:** passed');
  expect(changed.stdout).toContain('- **Reviewer decision:**');
  expect(changed.stdout).toContain('fresh');
  expect(changed.stdout).not.toContain('proof passed with Bearer');
});

test('prove record mode rejects invalid exit codes', async () => {
  const result = await runCli([
    'prove',
    '--record-command',
    'npm test -- tests/core/bugHunt.test.ts',
    '--exit-code',
    'not-a-number',
    '--duration-ms',
    '123',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('exit code');
});

test('prove console names scope and proof commands', async () => {
  const result = await runCli([
    'prove',
    '--intent',
    'split bugHunt.ts into ranking, evidence, and output modules',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Projscan Prove');
  expect(result.stdout).toContain('Allowed Files');
  expect(result.stdout).toContain('Proof Commands');
});

test('prove rejects mutually exclusive modes', async () => {
  const result = await runCli([
    'prove',
    '--intent',
    'split bugHunt.ts',
    '--changed',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('either --intent or --changed');
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, maxBuffer: 4 * 1024 * 1024 });
}
