import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnCli } from '../helpers/cli.js';
import {
  COMMAND_FORMAT_SUPPORT,
  OUTPUT_FORMATS,
  formatSupportRows,
} from '../../src/utils/formatSupport.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cli-format-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return spawnCli(cliPath, args, { cwd: tmp });
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

  it('applies scoped and redacted report controls to analyze SARIF output', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'private'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'src', 'public'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'private', 'a.ts'),
      `import { b } from './b.js';\nexport const a = b;\n`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'private', 'b.ts'),
      `import { a } from './a.js';\nexport const b = a;\n`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'public', 'c.ts'),
      `import { d } from './d.js';\nexport const c = d;\n`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'public', 'd.ts'),
      `import { c } from './c.js';\nexport const d = c;\n`,
    );

    const result = await runCli([
      'analyze',
      '--report-scope',
      'src/private',
      '--redact-paths',
      '--format',
      'sarif',
      '--quiet',
    ]);

    expect(result.exitCode).toBe(0);
    const sarif = JSON.parse(result.stdout);
    expect(sarif.runs[0].properties.reportControls).toEqual({
      active: true,
      scopeCount: 1,
      redactPaths: true,
      pathLabelFormat: 'redacted-path-N',
    });
    const uris = sarif.runs[0].results.flatMap((result: { locations: Array<unknown> }) =>
      result.locations.map(
        (location) =>
          (
            location as {
              physicalLocation: { artifactLocation: { uri: string } };
            }
          ).physicalLocation.artifactLocation.uri,
      ),
    );
    expect(uris.length).toBeGreaterThan(0);
    expect(uris.every((uri: string) => uri.startsWith('redacted-path-'))).toBe(true);
    expect(result.stdout).not.toContain('src/private');
    expect(result.stdout).not.toContain('src/public');
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
      "vitest run --exclude '.worktrees/**' tests/cli/privacyCheck.test.ts tests/cli/start.test.ts tests/cli/preflight.test.ts tests/mcp/start.test.ts tests/mcp/preflight.test.ts tests/mcp/fileChangedNotifications.test.ts tests/core/repositoryScanner.gitignore.test.ts tests/core/issueEngine.trustConfig.test.ts tests/utils/changedFiles.test.ts tests/core/auditRunner.offline.test.ts tests/core/upgradePreview.checkRegistry.test.ts tests/core/telemetry.test.ts tests/analyzers/securityCheck.test.ts --test-timeout 60000 --hook-timeout 60000",
    );
  });
});
