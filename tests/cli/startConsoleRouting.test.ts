import { beforeEach, expect, test } from 'vitest';
import { runStartCli } from '../helpers/startCli.js';
import { makeTempProject } from '../helpers/startProject.js';

let tmp: string;

beforeEach(async () => {
  tmp = await makeTempProject();
});

test('start console runs impact directly for file path intents', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I change src/core/start.ts',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Ready Now');
  expect(result.stdout).toContain('projscan impact src/core/start.ts --format json');
  expect(result.stdout).not.toContain('projscan search "src/core/start.ts" --format json');
  expect(result.stdout).not.toContain('\nAction Plan\n');
});

test('start console shows alternative routes for mixed intents', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'is it safe to commit and what breaks if I rename the auth token loader',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Start: before_commit');
  expect(result.stdout).toContain('Mode: inferred from intent');
  expect(result.stdout).toContain('Also Consider');
  expect(result.stdout).toContain(
    '- Safety gate: projscan preflight (confidence: high; matched: safe, commit)',
  );
});

test('start rejects unsupported formats through the shared matrix', async () => {
  const result = await runCli(['start', '--format', 'sarif', '--quiet']);

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('projscan start does not support --format sarif');
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runStartCli(tmp, args);
}
