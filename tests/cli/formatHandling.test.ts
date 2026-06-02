import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  COMMAND_FORMAT_SUPPORT,
  OUTPUT_FORMATS,
  formatSupportRows,
} from '../../src/utils/formatSupport.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-format-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
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
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: typeof e.code === 'number' ? e.code : 1 };
  }
}

describe('CLI format handling', () => {
  it('keeps command format support machine-readable and internally valid', () => {
    expect(OUTPUT_FORMATS).toEqual(['console', 'json', 'markdown', 'sarif', 'html']);
    expect(COMMAND_FORMAT_SUPPORT.doctor).toEqual(['console', 'json', 'markdown', 'sarif', 'html']);
    expect(COMMAND_FORMAT_SUPPORT.structure).toEqual(['console', 'json', 'markdown']);

    const knownFormats = new Set(OUTPUT_FORMATS);
    for (const [command, formats] of Object.entries(COMMAND_FORMAT_SUPPORT)) {
      expect(command.length).toBeGreaterThan(0);
      expect(formats.length).toBeGreaterThan(0);
      expect(new Set(formats).size).toBe(formats.length);
      for (const format of formats) {
        expect(knownFormats.has(format)).toBe(true);
      }
    }
    expect(formatSupportRows().map((row) => row.command)).toContain('analyze');
  });

  it('prints the generated format support matrix in help output', async () => {
    const result = await runCli(['help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Format Support');
    expect(result.stdout).toContain('projscan analyze');
    expect(result.stdout).toContain('console, json, markdown, sarif, html');
    expect(result.stdout).toContain('projscan structure');
    expect(result.stdout).toContain('console, json, markdown');
  });

  it('renders analyze as a real HTML document', async () => {
    const result = await runCli(['analyze', '--format', 'html', '--quiet']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^<!DOCTYPE html>/);
    expect(result.stdout).toContain(`<title>Analysis · ${path.basename(tmp)}</title>`);
    expect(result.stdout).toContain('src/index.ts');
    expect(result.stdout).not.toContain('ProjScan Project Report');
  });

  it('rejects unsupported command formats instead of falling back to console output', async () => {
    const result = await runCli(['structure', '--format', 'sarif', '--quiet']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('projscan structure does not support --format sarif');
    expect(result.stderr).toContain('Supported formats: console, json, markdown');
    expect(result.stdout).toBe('');
  });

  it('exposes a fast trust smoke script for privacy and onboarding regressions', async () => {
    const raw = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { scripts: Record<string, string> };

    expect(pkg.scripts['test:trust-smoke']).toBe(
      'vitest run tests/cli/privacyCheck.test.ts tests/cli/start.test.ts tests/cli/preflight.test.ts tests/mcp/start.test.ts tests/mcp/preflight.test.ts tests/mcp/fileChangedNotifications.test.ts tests/core/repositoryScanner.gitignore.test.ts tests/core/issueEngine.trustConfig.test.ts tests/utils/changedFiles.test.ts tests/core/auditRunner.offline.test.ts tests/core/upgradePreview.checkRegistry.test.ts tests/core/telemetry.test.ts tests/analyzers/securityCheck.test.ts --test-timeout 60000 --hook-timeout 60000',
    );
  });
});
