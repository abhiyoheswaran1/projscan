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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-evidence-regression-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '2.2.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('evidence-pack renders JSON and keeps package version unchanged', async () => {
  const result = await runCli([
    'evidence-pack',
    '--line',
    '2.3.x',
    '--line',
    '2.4.x',
    '--line',
    '2.5.x',
    '--line',
    '2.6.x',
    '--website-prompt',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.readOnly).toBe(true);
  expect(report.train.lines).toEqual(['2.3.x', '2.4.x', '2.5.x', '2.6.x']);
  expect(report.websitePrompt).toContain('projscan_evidence_pack');
  const pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8')) as { version: string };
  expect(pkg.version).toBe('2.2.0');
});

test('regression-plan renders a full command matrix', async () => {
  const result = await runCli(['regression-plan', '--level', 'full', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.level).toBe('full');
  expect(report.commands).toEqual(expect.arrayContaining(['projscan bug-hunt --format json', 'npm test', 'npm run build']));
});

test('regression-plan rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['regression-plan', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan regression-plan does not support --format sarif');
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
