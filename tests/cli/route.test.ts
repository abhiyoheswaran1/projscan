import path from 'node:path';
import { expect, test } from 'vitest';
import { spawnCli } from '../helpers/cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

test('route console shows confidence and matched keywords for the best tools', async () => {
  const result = await spawnCli(cliPath, [
    'route',
    'is',
    'it',
    'safe',
    'to',
    'commit',
    'this',
    'change',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('projscan_preflight');
  expect(result.stdout).toContain('confidence: high');
  expect(result.stdout).toContain('matched: safe, commit');
});

test('route accepts intent through the shared --intent option', async () => {
  const result = await spawnCli(cliPath, [
    'route',
    '--intent',
    'is it safe to commit this change',
    '--format',
    'json',
  ]);

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(
    expect.objectContaining({
      intent: 'is it safe to commit this change',
      matched: true,
    }),
  );
});

test('route points raw feedback reports to feedback intake', async () => {
  const result = await spawnCli(cliPath, [
    'route',
    '--intent',
    'unused-exports false positive: Next.js App Router and @/ alias import are flagged unused',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('projscan_feedback_intake');
  expect(result.stdout).toContain('projscan feedback intake --text');
});

test('route points raw install warning reports to feedback intake', async () => {
  const result = await spawnCli(cliPath, [
    'route',
    '--intent',
    'npm install -g projscan got allow-scripts warnings from tree-sitter-c-sharp node-gyp-build',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('projscan_feedback_intake');
  expect(result.stdout).toContain('projscan feedback intake --text');
});
