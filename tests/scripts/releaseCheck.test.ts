import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createReleaseCheckReport } from '../../scripts/release-check.mjs';

const repoRoot = process.cwd();
const script = join(repoRoot, 'scripts/release-check.mjs');
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('release readiness check', () => {
  it('reports the tag command when metadata is synced, pushed, and untagged', () => {
    const root = createReleaseFixture();

    const result = createReleaseCheckReport({
      root,
      runGates: false,
      remote: false,
      gitRunner: fakeGit({ status: '' }),
    }) as ReleaseCheckReport;

    expect(result.status).toBe('ready');
    expect(result.version).toBe('2.2.0');
    expect(result.tag).toBe('v2.2.0');
    expect(result.nextAction.command).toBe('git tag -a v2.2.0 -m "Release v2.2.0" && git push origin v2.2.0');
    expect(check(result, 'version-sync')?.status).toBe('ok');
    expect(check(result, 'changelog')?.status).toBe('ok');
    expect(check(result, 'worktree')?.status).toBe('ok');
    expect(check(result, 'local-tag')?.status).toBe('ok');
  });

  it('blocks on uncommitted release changes before suggesting tag creation', () => {
    const root = createReleaseFixture();
    writeFileSync(join(root, 'README.md'), 'local release note edit\n');

    const report = createReleaseCheckReport({
      root,
      runGates: false,
      remote: false,
      gitRunner: fakeGit({ status: ' M README.md\n' }),
    }) as ReleaseCheckReport;

    expect(report.status).toBe('blocked');
    expect(report.nextAction.kind).toBe('commit');
    expect(report.nextAction.command).toBe('git add . && git commit -m "chore: prepare v2.2.0 release"');
    expect(check(report, 'worktree')?.status).toBe('block');
  });
});

interface ReleaseCheckReport {
  status: 'ready' | 'blocked' | 'needs-action';
  version: string;
  tag: string;
  nextAction: { kind: string; command?: string };
  checks: Array<{ id: string; status: string }>;
}

function check(report: ReleaseCheckReport, id: string): { id: string; status: string } | undefined {
  return report.checks.find((item) => item.id === id);
}

function createReleaseFixture(): string {
  expect(existsSync(script)).toBe(true);
  const root = mkdtempSync(join(tmpdir(), 'projscan-release-check-'));
  tempRoots.push(root);

  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'projscan',
        version: '2.2.0',
        scripts: {
          'release:check': 'node scripts/release-check.mjs',
          'security:release-gate': 'node scripts/release-gate.mjs',
          'sbom:generate': 'node scripts/generate-sbom.mjs',
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({ name: 'projscan', version: '2.2.0', packages: { '': { version: '2.2.0' } } }, null, 2),
  );
  mkdirSync(join(root, '.github/mcp-registry'), { recursive: true });
  writeFileSync(
    join(root, '.github/mcp-registry/server.json'),
    JSON.stringify({ version: '2.2.0', packages: [{ version: '2.2.0' }] }, null, 2),
  );
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [2.2.0] - 2026-05-21\n\n- Release check.\n');
  writeFileSync(join(root, 'README.md'), 'fixture\n');

  return root;
}

function fakeGit({ status }: { status: string }) {
  return (_root: string, args: string[]) => {
    const command = args.join(' ');
    const responses: Record<string, { ok: boolean; stdout: string; stderr?: string; status?: number }> = {
      'rev-parse --is-inside-work-tree': { ok: true, stdout: 'true\n' },
      'branch --show-current': { ok: true, stdout: 'main\n' },
      'rev-parse HEAD': { ok: true, stdout: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' },
      'status --short': { ok: true, stdout: status },
      'rev-parse --abbrev-ref --symbolic-full-name @{u}': { ok: true, stdout: 'origin/main\n' },
      'rev-list --left-right --count HEAD...@{u}': { ok: true, stdout: '0\t0\n' },
      'rev-list -n 1 v2.2.0': { ok: false, stdout: '', stderr: 'fatal: ambiguous argument', status: 128 },
    };

    return responses[command] ?? { ok: false, stdout: '', stderr: `unexpected git command: ${command}`, status: 1 };
  };
}
