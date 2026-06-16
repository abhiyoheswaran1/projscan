import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-train-hunt-'));
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

test('release-train renders JSON without changing package version', async () => {
  const result = await runCli([
    'release-train',
    '--line',
    '2.3.x',
    '--line',
    '2.4.x',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.plan.readOnly).toBe(true);
  expect(report.tracks.map((track: { line: string }) => track.line)).toEqual(['2.3.x', '2.4.x']);
  const pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8')) as {
    version: string;
  };
  expect(pkg.version).toBe('2.2.0');
});

test('bug-hunt renders JSON fix queue', async () => {
  const result = await runCli(['bug-hunt', '--max-findings', '3', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.schemaVersion).toBe(1);
  expect(report.fixQueue.length).toBeGreaterThan(0);
  expect(report.fixQueue.length).toBeLessThanOrEqual(3);
});

test('bug-hunt CLI metadata describes an action queue', async () => {
  const source = await fs.readFile(path.join(repoRoot, 'src/cli/commands/bugHunt.ts'), 'utf-8');

  expect(source).toContain('Prioritize a bug-hunt action queue');
  expect(source).toContain("chalk.bold('Action Queue')");
  expect(source).not.toContain('bug-hunt fix queue');
  expect(source).not.toContain("chalk.bold('Fix Queue')");
});

test('bug-hunt JSON orders preflight fallback files for review routing', async () => {
  await writeJson(path.join(tmp, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    devDependencies: { vitest: '^3.0.0' },
    eslintConfig: { root: true },
    prettier: {},
  });
  await fs.writeFile(
    path.join(tmp, 'README.md'),
    '# fixture\n\nA focused fixture with setup notes, usage examples, and verification guidance.\n',
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\nnode_modules\n');
  await fs.writeFile(path.join(tmp, '.editorconfig'), 'root = true\n');
  await fs.writeFile(path.join(tmp, 'src', 'index.test.ts'), 'export const ok = true;\n');
  await git(['init']);
  await git(['config', 'user.email', 'agent@example.com']);
  await git(['config', 'user.name', 'Agent']);
  await git(['add', '.']);
  await git(['commit', '-m', 'baseline']);

  await fs.mkdir(path.join(tmp, '.agentflight'), { recursive: true });
  await writeJson(path.join(tmp, '.agentflight', 'config.json'), { localOnly: true });
  await writeJson(path.join(tmp, 'package.json'), {
    name: 'fixture',
    version: '0.0.1',
    type: 'module',
    devDependencies: { vitest: '^3.0.0' },
    eslintConfig: { root: true },
    prettier: {},
  });
  await writeJson(path.join(tmp, 'package-lock.json'), {
    name: 'fixture',
    version: '0.0.1',
    lockfileVersion: 3,
    packages: {},
  });
  await fs.writeFile(
    path.join(tmp, 'README.md'),
    '# fixture\n\nUpdated release notes, setup notes, usage examples, and verification guidance.\n',
  );
  await fs.mkdir(path.join(tmp, 'packages', 'api'), { recursive: true });
  await writeJson(path.join(tmp, 'packages', 'api', 'package.json'), {
    name: '@fixture/api',
    version: '0.0.1',
  });
  await fs.writeFile(path.join(tmp, 'src', 'index.test.ts'), 'export const ok = false;\n');
  await fs.writeFile(
    path.join(tmp, 'src', 'index.ts'),
    [
      'export function complex(value: number) {',
      ...Array.from(
        { length: 90 },
        (_, index) => `  if (value > ${index + 1}) return ${index + 1};`,
      ),
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  );

  const result = await runCli(['bug-hunt', '--max-findings', '5', '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  const preflightFinding = report.fixQueue.find(
    (finding: { source: string; files: string[] }) => finding.source === 'preflight',
  );
  expect(preflightFinding?.files.slice(0, 4)).toEqual([
    'package.json',
    'package-lock.json',
    'packages/api/package.json',
    'src/index.ts',
  ]);
  expect(preflightFinding?.files.indexOf('README.md')).toBeGreaterThan(
    preflightFinding?.files.indexOf('src/index.test.ts') ?? -1,
  );
  expect(preflightFinding?.files.at(-1)).toBe('.agentflight/config.json');
  expect(preflightFinding?.evidence[0]).toEqual(expect.objectContaining({ file: 'package.json' }));
}, 120_000);

test('bug-hunt rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['bug-hunt', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan bug-hunt does not support --format sarif');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
}

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
