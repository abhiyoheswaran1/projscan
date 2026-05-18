import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-reporter-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;\n');
  await writePluginFixture(tmp);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function runCli(
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: tmp,
      env: { ...process.env, ...env },
      maxBuffer: 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: typeof e.code === 'number' ? e.code : 1 };
  }
}

async function writePluginFixture(root: string): Promise<void> {
  const pluginDir = path.join(root, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'policy.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'policy',
      kind: 'analyzer',
      module: './policy.mjs',
      category: 'custom',
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'policy.mjs'),
    `export default {
      check: async () => [{
        id: 'blocked',
        title: 'Blocked fixture pattern',
        description: 'Fixture issue from analyzer plugin.',
        severity: 'error',
        category: 'custom',
        fixAvailable: false,
        locations: [{ file: 'src/a.ts', line: 1 }],
      }],
    };`,
  );
  await fs.writeFile(
    path.join(pluginDir, 'team-summary.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'team-summary',
      kind: 'reporter',
      module: './team-summary.mjs',
      commands: ['doctor', 'analyze', 'ci'],
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'team-summary.mjs'),
    `export default {
      render: async ({ command, payload }) => {
        const issues = command === 'ci' ? payload.ci.issues : payload.issues;
        const hasPluginIssue = issues.some((issue) => issue.id === 'plugin:policy:blocked');
        const score = command === 'ci' ? payload.ci.score : payload.health?.score ?? 'analysis';
        return \`reporter:\${command}:\${hasPluginIssue ? 'plugin' : 'missing'}:\${score}\`;
      },
    };`,
  );
}

describe('CLI reporter plugins', () => {
  it('describes plugin commands as the stable local platform', async () => {
    const result = await runCli(['plugin', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Discover and validate local plugins');
    expect(result.stdout).not.toContain('preview');
    expect(result.stdout).not.toContain('1.10');
  });

  it('renders doctor output through a reporter plugin', async () => {
    const result = await runCli(['doctor', '--reporter', 'team-summary', '--quiet'], {
      PROJSCAN_PLUGINS_PREVIEW: '1',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^reporter:doctor:plugin:/);
  });

  it('renders analyze output through a reporter plugin', async () => {
    const result = await runCli(['analyze', '--reporter', 'team-summary', '--quiet'], {
      PROJSCAN_PLUGINS_PREVIEW: '1',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('reporter:analyze:plugin:analysis');
  });

  it('prints reporter output before preserving ci exit behavior', async () => {
    const result = await runCli(['ci', '--reporter', 'team-summary', '--min-score', '100', '--quiet'], {
      PROJSCAN_PLUGINS_PREVIEW: '1',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout.trim()).toMatch(/^reporter:ci:plugin:/);
  });

  it('fails clearly when reporter plugins are not enabled', async () => {
    const result = await runCli(['doctor', '--reporter', 'team-summary', '--quiet']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('PROJSCAN_PLUGINS_PREVIEW');
  });

  it('rejects combining reporter plugins with core formats', async () => {
    const result = await runCli(['doctor', '--reporter', 'team-summary', '--format', 'json', '--quiet'], {
      PROJSCAN_PLUGINS_PREVIEW: '1',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--reporter cannot be combined with --format json');
  });
});
