import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-assess-snapshot-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n\nSnapshot fixture.\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('assess compares current risk against a prior baseline file', async () => {
  const baselinePath = path.join(tmp, 'assess-baseline.json');
  await fs.writeFile(
    baselinePath,
    JSON.stringify({
      schemaVersion: 1,
      riskDelta: { projectedScore: 1 },
    }),
  );

  const result = await runCli(['assess', '--baseline', baselinePath, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.baselineComparison.baselinePath).toBe(baselinePath);
  expect(typeof report.baselineComparison.delta).toBe('number');
});

test('assess baseline errors do not print file contents', async () => {
  const baselinePath = path.join(tmp, 'bad-baseline.json');
  await fs.writeFile(baselinePath, '{"secret":"do-not-print","riskDelta":');

  const result = await runCli(['assess', '--baseline', baselinePath, '--format', 'json', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Could not read assess baseline');
  expect(result.stderr).not.toContain('do-not-print');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp, maxBuffer: 4 * 1024 * 1024 });
}

