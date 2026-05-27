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

  it('blocks release tagging from branches other than main', () => {
    const root = createReleaseFixture();

    const report = createReleaseCheckReport({
      root,
      runGates: false,
      remote: false,
      gitRunner: fakeGit({ branch: 'fix/release-prep', status: '' }),
    }) as ReleaseCheckReport;

    expect(report.status).toBe('blocked');
    expect(report.nextAction.kind).toBe('switch-main');
    expect(report.nextAction.command).toBe('git switch main && git pull --ff-only origin main');
    expect(check(report, 'release-branch')?.status).toBe('block');
  });

  it('blocks when origin already has the version tag but its peeled commit differs from HEAD', () => {
    const root = createReleaseFixture();

    const report = createReleaseCheckReport({
      root,
      runGates: false,
      remote: true,
      gitRunner: fakeGit({
        status: '',
        remoteTag:
          'cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v2.2.0\n' +
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v2.2.0^{}\n',
      }),
    }) as ReleaseCheckReport;

    expect(report.status).toBe('blocked');
    expect(report.git.remoteTag).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(check(report, 'remote-tag')?.status).toBe('block');
    expect(report.nextAction.kind).toBe('fix-blockers');
  });

  it('runs the graph corpus check as part of release gates after build and stability', () => {
    const root = createReleaseFixture();
    const gates: string[] = [];

    const report = createReleaseCheckReport({
      root,
      runGates: true,
      remote: false,
      gitRunner: fakeGit({ status: '' }),
      gateRunner: (_root: string, command: string, args: string[]) => {
        gates.push([command, ...args].join(' '));
        return { status: 0 };
      },
    }) as ReleaseCheckReport;

    expect(report.status).toBe('ready');
    expect(gates).toContain('npm run check:graph-corpus');
    expect(gates.indexOf('npm run check:graph-corpus')).toBeGreaterThan(gates.indexOf('npm run build'));
    expect(gates.indexOf('npm run check:graph-corpus')).toBeGreaterThan(gates.indexOf('npm run check:stability'));
  });
});

interface ReleaseCheckReport {
  status: 'ready' | 'blocked' | 'needs-action';
  version: string;
  tag: string;
  git: { remoteTag: string | null };
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

function fakeGit({ branch = 'main', status, remoteTag = '' }: { branch?: string; status: string; remoteTag?: string }) {
  return (_root: string, args: string[]) => {
    const command = args.join(' ');
    const responses: Record<string, { ok: boolean; stdout: string; stderr?: string; status?: number }> = {
      'rev-parse --is-inside-work-tree': { ok: true, stdout: 'true\n' },
      'branch --show-current': { ok: true, stdout: `${branch}\n` },
      'rev-parse HEAD': { ok: true, stdout: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' },
      'status --short': { ok: true, stdout: status },
      'rev-parse --abbrev-ref --symbolic-full-name @{u}': { ok: true, stdout: 'origin/main\n' },
      'rev-list --left-right --count HEAD...@{u}': { ok: true, stdout: '0\t0\n' },
      'rev-list -n 1 v2.2.0': { ok: false, stdout: '', stderr: 'fatal: ambiguous argument', status: 128 },
      'ls-remote --tags origin refs/tags/v2.2.0 refs/tags/v2.2.0^{}': { ok: true, stdout: remoteTag },
    };

    return responses[command] ?? { ok: false, stdout: '', stderr: `unexpected git command: ${command}`, status: 1 };
  };
}
