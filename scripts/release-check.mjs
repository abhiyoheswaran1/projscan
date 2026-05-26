#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');

export function createReleaseCheckReport(options = {}) {
  const ctx = {
    root: path.resolve(options.root ?? defaultRoot),
    runGates: options.runGates ?? true,
    remote: options.remote ?? true,
    gitRunner: options.gitRunner ?? defaultGitRunner,
    gateRunner: options.gateRunner ?? defaultGateRunner,
    checks: [],
    gitState: {
      branch: null,
      head: null,
      upstream: null,
      ahead: null,
      behind: null,
      dirty: false,
      localTag: null,
      remoteTag: null,
    },
  };

  const pkg = readJson(ctx, 'package.json');
  const version = typeof pkg?.version === 'string' ? pkg.version : null;
  const tag = version ? `v${version}` : null;

  checkVersionSync(ctx, pkg);
  checkChangelog(ctx, version);
  checkReleaseScripts(ctx, pkg);
  checkGitState(ctx, tag);

  const hasPreGateBlockers = hasBlocks(ctx);
  if (ctx.runGates && !hasPreGateBlockers) {
    runReleaseGates(ctx);
  } else if (!ctx.runGates) {
    addCheck(
      ctx,
      'release-gates',
      'Fresh release gates',
      'skip',
      'Skipped by --skip-gates',
      'Run without --skip-gates to execute build, release gate, tests, lint, stability, SBOM, and packed install.',
    );
  } else {
    addCheck(
      ctx,
      'release-gates',
      'Fresh release gates',
      'skip',
      'Skipped because earlier blockers must be fixed first',
      'Release gates are only useful after metadata and git state are ready.',
    );
  }

  const nextAction = chooseNextAction(ctx, tag);
  const status = hasBlocks(ctx) ? 'blocked' : nextAction.kind === 'approve-actions' ? 'needs-action' : 'ready';

  return {
    status,
    version,
    tag,
    root: ctx.root,
    git: ctx.gitState,
    checks: ctx.checks,
    nextAction,
  };
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = createReleaseCheckReport({
    root: args.root,
    runGates: args.runGates,
    remote: args.remote,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHuman(report);
  }

  return report.status === 'blocked' ? 1 : 0;
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  process.exit(runCli());
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    root: null,
    runGates: true,
    remote: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--skip-gates' || arg === '--no-gates') parsed.runGates = false;
    else if (arg === '--run-gates') parsed.runGates = true;
    else if (arg === '--skip-remote' || arg === '--no-remote') parsed.remote = false;
    else if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) failUsage('--root requires a path');
      parsed.root = value;
      i += 1;
    } else if (arg.startsWith('--root=')) {
      parsed.root = arg.slice('--root='.length);
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      failUsage(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function failUsage(message) {
  console.error(message);
  printUsage();
  process.exit(2);
}

function printUsage() {
  console.log(`Usage: node scripts/release-check.mjs [options]

Options:
  --json          Emit a machine-readable report
  --root <path>  Check another repository root
  --skip-gates   Skip build/test/audit/SBOM/packed-install gates
  --skip-remote  Skip remote tag lookup
`);
}

function readJson(ctx, relativePath) {
  const file = path.join(ctx.root, relativePath);
  if (!existsSync(file)) {
    addCheck(ctx, relativePath, relativePath, 'block', `${relativePath} is missing`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    addCheck(ctx, relativePath, relativePath, 'block', `${relativePath} is not valid JSON`, String(error?.message ?? error));
    return null;
  }
}

function checkVersionSync(ctx, packageJson) {
  const packageVersion = typeof packageJson?.version === 'string' ? packageJson.version : null;
  const lock = readJson(ctx, 'package-lock.json');
  const registry = readJson(ctx, '.github/mcp-registry/server.json');
  const problems = [];

  if (!packageVersion) problems.push('package.json#version is missing');
  if (lock?.version !== packageVersion) problems.push(`package-lock.json#version is ${formatValue(lock?.version)}`);
  if (lock?.packages?.['']?.version !== packageVersion) {
    problems.push(`package-lock.json#packages[""].version is ${formatValue(lock?.packages?.['']?.version)}`);
  }
  if (registry?.version !== packageVersion) {
    problems.push(`server.json#version is ${formatValue(registry?.version)}`);
  }
  if (registry?.packages?.[0]?.version !== packageVersion) {
    problems.push(`server.json#packages[0].version is ${formatValue(registry?.packages?.[0]?.version)}`);
  }

  addCheck(
    ctx,
    'version-sync',
    'Version metadata',
    problems.length === 0 ? 'ok' : 'block',
    problems.length === 0 ? `All release metadata points at ${packageVersion}` : problems.join('; '),
  );
}

function checkChangelog(ctx, packageVersion) {
  if (!packageVersion) {
    addCheck(ctx, 'changelog', 'CHANGELOG entry', 'block', 'Cannot check changelog without package.json#version');
    return;
  }

  const file = path.join(ctx.root, 'CHANGELOG.md');
  if (!existsSync(file)) {
    addCheck(ctx, 'changelog', 'CHANGELOG entry', 'block', 'CHANGELOG.md is missing');
    return;
  }

  const changelog = readFileSync(file, 'utf8');
  const re = new RegExp(`^## \\[${escapeRegExp(packageVersion)}\\]`, 'm');
  addCheck(
    ctx,
    'changelog',
    'CHANGELOG entry',
    re.test(changelog) ? 'ok' : 'block',
    re.test(changelog)
      ? `CHANGELOG.md contains a ${packageVersion} entry`
      : `CHANGELOG.md needs a "## [${packageVersion}]" entry`,
  );
}

function checkReleaseScripts(ctx, packageJson) {
  const scripts = packageJson?.scripts ?? {};
  const problems = [];

  if (scripts['release:check'] !== 'node scripts/release-check.mjs') {
    problems.push('package.json scripts.release:check must be "node scripts/release-check.mjs"');
  }
  if (scripts['security:release-gate'] !== 'node scripts/release-gate.mjs') {
    problems.push('package.json scripts.security:release-gate must be "node scripts/release-gate.mjs"');
  }
  if (scripts['sbom:generate'] !== 'node scripts/generate-sbom.mjs') {
    problems.push('package.json scripts.sbom:generate must be "node scripts/generate-sbom.mjs"');
  }

  addCheck(
    ctx,
    'release-scripts',
    'Release scripts',
    problems.length === 0 ? 'ok' : 'block',
    problems.length === 0 ? 'release:check, security:release-gate, and sbom:generate are wired' : problems.join('; '),
  );
}

function checkGitState(ctx, releaseTag) {
  const inside = git(ctx, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    addCheck(ctx, 'git', 'Git repository', 'block', 'Release check must run inside a git worktree');
    return;
  }

  ctx.gitState.branch = git(ctx, ['branch', '--show-current']).stdout.trim() || null;
  ctx.gitState.head = git(ctx, ['rev-parse', 'HEAD']).stdout.trim() || null;

  const status = git(ctx, ['status', '--short']);
  const dirtyLines = status.stdout.trim().split('\n').filter(Boolean);
  ctx.gitState.dirty = dirtyLines.length > 0;
  addCheck(
    ctx,
    'worktree',
    'Worktree',
    dirtyLines.length === 0 ? 'ok' : 'block',
    dirtyLines.length === 0 ? 'No uncommitted changes' : `${dirtyLines.length} uncommitted path(s)`,
    dirtyLines.slice(0, 12).join('\n'),
  );

  const upstream = git(ctx, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.ok) {
    ctx.gitState.upstream = upstream.stdout.trim();
    const counts = git(ctx, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
    if (counts.ok) {
      const [ahead, behind] = counts.stdout.trim().split(/\s+/).map((value) => Number.parseInt(value, 10));
      ctx.gitState.ahead = Number.isFinite(ahead) ? ahead : null;
      ctx.gitState.behind = Number.isFinite(behind) ? behind : null;
      addCheck(
        ctx,
        'upstream',
        'Upstream sync',
        behind > 0 ? 'block' : ahead > 0 ? 'warn' : 'ok',
        behind > 0
          ? `${ctx.gitState.branch ?? 'HEAD'} is ${behind} commit(s) behind ${ctx.gitState.upstream}`
          : ahead > 0
            ? `${ctx.gitState.branch ?? 'HEAD'} is ${ahead} commit(s) ahead of ${ctx.gitState.upstream}`
            : `${ctx.gitState.branch ?? 'HEAD'} matches ${ctx.gitState.upstream}`,
      );
    } else {
      addCheck(ctx, 'upstream', 'Upstream sync', 'warn', 'Could not compare HEAD with upstream', counts.stderr.trim());
    }
  } else {
    addCheck(ctx, 'upstream', 'Upstream sync', 'warn', 'No upstream branch is configured');
  }

  if (!releaseTag) {
    addCheck(ctx, 'local-tag', 'Local tag', 'block', 'Cannot check local tag without package version');
    addCheck(ctx, 'remote-tag', 'Remote tag', 'block', 'Cannot check remote tag without package version');
    return;
  }

  const localTag = git(ctx, ['rev-list', '-n', '1', releaseTag]);
  if (localTag.ok) {
    ctx.gitState.localTag = localTag.stdout.trim();
    addCheck(
      ctx,
      'local-tag',
      'Local tag',
      ctx.gitState.localTag === ctx.gitState.head ? 'ok' : 'block',
      ctx.gitState.localTag === ctx.gitState.head
        ? `${releaseTag} points at HEAD`
        : `${releaseTag} points at ${shortSha(ctx.gitState.localTag)}, not HEAD ${shortSha(ctx.gitState.head)}`,
    );
  } else {
    addCheck(ctx, 'local-tag', 'Local tag', 'ok', `No local ${releaseTag} tag exists yet`);
  }

  if (!ctx.remote) {
    addCheck(ctx, 'remote-tag', 'Remote tag', 'skip', 'Skipped by --skip-remote');
    return;
  }

  const remoteTag = git(ctx, ['ls-remote', '--tags', 'origin', `refs/tags/${releaseTag}`], { timeout: 15000 });
  if (!remoteTag.ok) {
    addCheck(ctx, 'remote-tag', 'Remote tag', 'warn', `Could not check origin/${releaseTag}`, remoteTag.stderr.trim());
    return;
  }

  const remoteLine = remoteTag.stdout.trim();
  ctx.gitState.remoteTag = remoteLine ? remoteLine.split(/\s+/)[0] : null;
  addCheck(
    ctx,
    'remote-tag',
    'Remote tag',
    'ok',
    ctx.gitState.remoteTag ? `origin already has ${releaseTag}` : `origin does not have ${releaseTag}`,
  );
}

function runReleaseGates(ctx) {
  const gates = [
    ['build', 'npm', ['run', 'build']],
    ['security-release-gate', 'npm', ['run', 'security:release-gate']],
    ['tests', 'npm', ['test']],
    ['lint', 'npm', ['run', 'lint']],
    ['stability', 'npm', ['run', 'check:stability']],
    ['sbom', 'npm', ['run', 'sbom:generate']],
    ['packed-install-smoke', 'npm', ['run', 'smoke:packed-install']],
  ];

  for (const [id, command, commandArgs] of gates) {
    const result = ctx.gateRunner(ctx.root, command, commandArgs);
    if (result.status === 0) {
      addCheck(ctx, id, commandArgs.join(' '), 'ok', 'Passed');
      continue;
    }

    addCheck(
      ctx,
      id,
      commandArgs.join(' '),
      'block',
      `Failed with exit code ${result.status ?? 'unknown'}`,
      [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    );
    return;
  }
}

function chooseNextAction(ctx, releaseTag) {
  if (hasCheckBlock(ctx, 'version-sync') || hasCheckBlock(ctx, 'changelog') || hasCheckBlock(ctx, 'release-scripts')) {
    return {
      kind: 'fix-metadata',
      summary: 'Fix release metadata before committing or tagging.',
    };
  }

  if (hasCheckBlock(ctx, 'worktree')) {
    return {
      kind: 'commit',
      summary: 'Commit the release changes before tagging.',
      command: releaseTag
        ? `git add . && git commit -m "chore: prepare ${releaseTag} release"`
        : 'git add . && git commit -m "chore: prepare release"',
    };
  }

  if (ctx.gitState.behind && ctx.gitState.behind > 0) {
    return {
      kind: 'sync-branch',
      summary: `Bring ${ctx.gitState.branch ?? 'HEAD'} up to date with ${ctx.gitState.upstream ?? 'upstream'} before release.`,
    };
  }

  if (ctx.gitState.ahead && ctx.gitState.ahead > 0) {
    return {
      kind: 'push-branch',
      summary: `Push ${ctx.gitState.branch ?? 'the release branch'} before tagging.`,
      command: 'git push',
    };
  }

  if (hasCheckBlock(ctx, 'local-tag')) {
    return {
      kind: 'fix-local-tag',
      summary: `${releaseTag ?? 'The release tag'} exists locally but does not point at HEAD.`,
    };
  }

  if (hasBlocks(ctx)) {
    return {
      kind: 'fix-blockers',
      summary: 'Fix blocked checks before release.',
    };
  }

  if (ctx.gitState.remoteTag) {
    return {
      kind: 'approve-actions',
      summary: `Open GitHub Actions for ${releaseTag} and approve the npm-release environment if it is waiting.`,
    };
  }

  if (ctx.gitState.localTag) {
    return {
      kind: 'push-tag',
      summary: `Push ${releaseTag} to start the GitHub release workflow.`,
      command: `git push origin ${releaseTag}`,
    };
  }

  return {
    kind: 'create-and-push-tag',
    summary: `Create and push ${releaseTag} to start the GitHub release workflow.`,
    command: `git tag -a ${releaseTag} -m "Release ${releaseTag}" && git push origin ${releaseTag}`,
  };
}

function addCheck(ctx, id, label, status, summary, detail = undefined) {
  ctx.checks.push({ id, label, status, summary, ...(detail ? { detail } : {}) });
}

function hasBlocks(ctx) {
  return ctx.checks.some((check) => check.status === 'block');
}

function hasCheckBlock(ctx, id) {
  return ctx.checks.some((check) => check.id === id && check.status === 'block');
}

function git(ctx, commandArgs, options = {}) {
  return ctx.gitRunner(ctx.root, commandArgs, options);
}

function defaultGitRunner(root, commandArgs, options = {}) {
  try {
    const stdout = execFileSync('git', commandArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout ?? 10000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr: '', status: 0 };
  } catch (error) {
    return {
      ok: false,
      stdout: typeof error?.stdout === 'string' ? error.stdout : '',
      stderr: typeof error?.stderr === 'string' ? error.stderr : String(error?.message ?? error),
      status: typeof error?.status === 'number' ? error.status : 1,
    };
  }
}

function defaultGateRunner(root, command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
}

function printHuman(report) {
  console.log(`Release readiness for projscan@${report.version ?? 'unknown'} (${report.tag ?? 'no tag'})`);
  console.log('');

  for (const check of report.checks) {
    console.log(`${icon(check.status)} ${check.label}: ${check.summary}`);
    if (check.detail) {
      const detail = check.detail
        .split('\n')
        .slice(0, 12)
        .map((line) => `    ${line}`)
        .join('\n');
      console.log(detail);
    }
  }

  console.log('');
  console.log(`Status: ${report.status}`);
  console.log(`Next: ${report.nextAction.summary}`);
  if (report.nextAction.command) console.log(`Command: ${report.nextAction.command}`);
}

function icon(statusValue) {
  if (statusValue === 'ok') return '[ok]';
  if (statusValue === 'block') return '[block]';
  if (statusValue === 'warn') return '[warn]';
  return '[skip]';
}

function formatValue(value) {
  return value === undefined ? 'missing' : JSON.stringify(value);
}

function shortSha(value) {
  return value ? value.slice(0, 7) : 'unknown';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
