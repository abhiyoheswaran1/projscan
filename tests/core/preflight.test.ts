import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { PreflightMode, PreflightReason, PreflightReport } from '../../src/types.js';
import {
  computePreflight,
  decidePreflightVerdict,
  summarizePreflight,
} from '../../src/core/preflight.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { inspectFile } from '../../src/core/fileInspector.js';
import { loadSession, recordTouch, saveSession } from '../../src/core/session.js';
import { PLUGIN_TRUST_HOME_ENV, trustPlugin } from '../../src/core/pluginTrust.js';
import type { FileEntry } from '../../src/types.js';

const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);
let originalPluginFlag: string | undefined;
let originalTrustHome: string | undefined;
let trustHome: string;

beforeEach(async () => {
  originalPluginFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  originalTrustHome = process.env[PLUGIN_TRUST_HOME_ENV];
  delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  trustHome = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-trust-'));
  process.env[PLUGIN_TRUST_HOME_ENV] = trustHome;
});

afterEach(async () => {
  if (originalPluginFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalPluginFlag;
  if (originalTrustHome === undefined) delete process.env[PLUGIN_TRUST_HOME_ENV];
  else process.env[PLUGIN_TRUST_HOME_ENV] = originalTrustHome;
  await fs.rm(trustHome, { recursive: true, force: true });
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('preflight contract supports the three agent modes', () => {
  const modes: PreflightMode[] = ['before_edit', 'before_commit', 'before_merge'];

  expect(modes).toEqual(['before_edit', 'before_commit', 'before_merge']);
});

test('preflight verdict escalates from reasons', () => {
  const warning: PreflightReason = {
    severity: 'warning',
    source: 'doctor',
    message: 'warning',
  };
  const error: PreflightReason = {
    severity: 'error',
    source: 'review',
    message: 'error',
  };

  expect(decidePreflightVerdict([])).toBe('proceed');
  expect(decidePreflightVerdict([warning])).toBe('caution');
  expect(decidePreflightVerdict([warning, error])).toBe('block');
});

test('preflight summary is compact and agent-ready', () => {
  const report: PreflightReport = {
    schemaVersion: 1,
    mode: 'before_edit',
    verdict: 'proceed',
    summary: '',
    reasons: [],
    evidence: {},
    requiredChecks: [],
    suggestedNextActions: [],
    toolCalls: [],
  };

  expect(summarizePreflight(report)).toBe('proceed: no blocking or cautionary signals found');
});

test('preflight keeps policy issue reason formatting isolated from the reason orchestrator', async () => {
  const preflightSource = await fs.readFile(path.join(process.cwd(), 'src/core/preflight.ts'), 'utf-8');
  expect(preflightSource).not.toContain('Supply-chain gate blocks');
  expect(preflightSource).not.toContain('Plugin policy blocks');

  const issueReasons = await inspectRepoSourceFile('src/core/preflightIssueReasons.ts');
  const policyIssueReasons = issueReasons.functions?.find(
    (fn) => fn.name === 'policyIssueReasons',
  );
  const supplyChainIssueReason = issueReasons.functions?.find(
    (fn) => fn.name === 'supplyChainIssueReason',
  );
  const pluginIssueReason = issueReasons.functions?.find((fn) => fn.name === 'pluginIssueReason');

  expect(policyIssueReasons).toBeDefined();
  expect(policyIssueReasons!.cyclomaticComplexity).toBeLessThanOrEqual(2);
  expect(supplyChainIssueReason).toBeDefined();
  expect(supplyChainIssueReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  expect(pluginIssueReason).toBeDefined();
  expect(pluginIssueReason!.cyclomaticComplexity).toBeLessThanOrEqual(3);
});

test('before_edit works outside git and returns a complete report', async () => {
  const root = await makeTempProject();

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('before_edit');
  expect(['proceed', 'caution', 'block']).toContain(report.verdict);
  expect(report.summary).toContain(report.verdict);
  expect(report.evidence.changedFiles?.available).toBe(false);
});

test('plugin policy errors block preflight when preview execution is already trusted', async () => {
  process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
  const root = await makeTempProject();
  await writeErrorPlugin(root);
  // Trust-on-first-use: the plugin only executes once its bytes are approved.
  await trustPlugin(path.join(root, '.projscan-plugins', 'policy.mjs'), 'policy');

  const report = await computePreflight(root, { mode: 'before_edit', enablePlugins: true });

  expect(report.verdict).toBe('block');
  expect(report.evidence.plugins).toEqual(
    expect.objectContaining({ enabled: true, errorIssues: 1 }),
  );
  expect(
    report.reasons.some((reason) => reason.source === 'plugin' && reason.severity === 'error'),
  ).toBe(true);
});

test('preflight enablePlugins option does not enable local plugin code without preview flag', async () => {
  const root = await makeTempProject();
  const markerPath = path.join(root, 'plugin-executed.txt');
  await writeMarkerPlugin(root, markerPath);

  const report = await computePreflight(root, { mode: 'before_edit', enablePlugins: true });

  expect(report.verdict).not.toBe('block');
  expect(report.evidence.plugins).toEqual(expect.objectContaining({ enabled: false }));
  expect(report.reasons.some((reason) => reason.source === 'plugin')).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('known compromised package versions block preflight', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    dependencies: {
      '@tanstack/react-router': '1.169.5',
    },
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.verdict).toBe('block');
  expect(report.evidence.supplyChain).toEqual(
    expect.objectContaining({ errorIssues: 1, warningIssues: 0 }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'error',
        issueId: 'supply-chain-malicious-package-@tanstack/react-router',
      }),
    ]),
  );
});

test('hidden editor persistence hooks block preflight', async () => {
  const root = await makeTempProject();
  await fs.mkdir(path.join(root, '.vscode'), { recursive: true });
  await writeJson(path.join(root, '.vscode', 'tasks.json'), {
    version: '2.0.0',
    tasks: [
      {
        label: 'monitor',
        type: 'shell',
        command: 'gh-token-monitor --watch && rm -rf ~',
      },
    ],
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.verdict).toBe('block');
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'error',
        issueId: 'supply-chain-hidden-persistence-hook',
        file: '.vscode/tasks.json',
      }),
    ]),
  );
});

test('risky git dependencies and lifecycle scripts caution preflight', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    optionalDependencies: {
      'team-policy': 'github:example/team-policy#2e5f6c7d8a9b0c1d2e3f4a5b6c7d8e9f00112233',
    },
    scripts: {
      postinstall: 'node ./scripts/setup.js',
    },
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.verdict).toBe('caution');
  expect(report.evidence.supplyChain).toEqual(
    expect.objectContaining({ errorIssues: 0, warningIssues: 2 }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'warning',
        issueId: 'supply-chain-git-dependency-team-policy',
      }),
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'warning',
        issueId: 'supply-chain-lifecycle-postinstall',
      }),
    ]),
  );
});

test('expected build prepare scripts do not caution preflight', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    scripts: {
      build: 'tsc',
      prepare: 'npm run build',
    },
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.reasons.some((reason) => reason.issueId === 'supply-chain-lifecycle-prepare')).toBe(
    false,
  );
  expect(report.evidence.supplyChain).toEqual(
    expect.objectContaining({ errorIssues: 0, warningIssues: 0 }),
  );
});

test('preflight truncates large session evidence for agent-sized output', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  for (let i = 0; i < 75; i += 1) {
    recordTouch(session, `src/file-${i}.ts`, 'explicit');
  }
  await saveSession(root, session);

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.truncated).toBe(true);
  expect(report.evidence.session?.touchedFiles.length).toBeLessThanOrEqual(40);
  expect(report.evidence.session?.totalTouchedFiles).toBe(75);
});

test('preflight session evidence prefers most recent touched files', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/a-old.ts', 'explicit');
  recordTouch(session, 'src/z-new.ts', 'explicit');
  session.touchedFiles['src/a-old.ts'].lastTouchedAt = '2026-05-18T10:00:00.000Z';
  session.touchedFiles['src/z-new.ts'].lastTouchedAt = '2026-05-18T10:01:00.000Z';
  await saveSession(root, session);

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.evidence.session?.touchedFiles.slice(0, 2)).toEqual([
    'src/z-new.ts',
    'src/a-old.ts',
  ]);
});

test('preflight separates current worktree evidence from remembered session context', async () => {
  const root = await makeTempProject();
  const { session } = await loadSession(root);
  recordTouch(session, 'src/index.ts', 'explicit');
  await saveSession(root, session);

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.evidence.riskSources?.currentWorktree).toEqual(
    expect.objectContaining({
      kind: 'current-worktree',
      available: false,
      count: 0,
      reason: 'changed-file detection is not required before edits',
    }),
  );
  expect(report.evidence.riskSources?.sessionMemory).toEqual(
    expect.objectContaining({
      kind: 'remembered-session',
      touchedFiles: ['src/index.ts'],
      totalTouchedFiles: 1,
      note: expect.stringContaining('remembered'),
    }),
  );
  expect(report.evidence.session?.kind).toBe('remembered-session');
});

test('before_commit treats scale-only review blocks as manual sign-off caution', async () => {
  const root = await makeTempProject();
  await git(root, ['init']);
  await git(root, ['config', 'user.email', 'agent@example.com']);
  await git(root, ['config', 'user.name', 'Agent']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);

  await fs.writeFile(
    path.join(root, 'src', 'index.ts'),
    [
      'export function complex(value: number) {',
      '  if (value > 1) return 1;',
      '  if (value > 2) return 2;',
      '  if (value > 3) return 3;',
      '  if (value > 4) return 4;',
      '  if (value > 5) return 5;',
      '  if (value > 6) return 6;',
      '  if (value > 7) return 7;',
      '  if (value > 8) return 8;',
      '  if (value > 9) return 9;',
      '  if (value > 10) return 10;',
      '  if (value > 11) return 11;',
      '  if (value > 12) return 12;',
      '  if (value > 13) return 13;',
      '  if (value > 14) return 14;',
      '  if (value > 15) return 15;',
      '  if (value > 16) return 16;',
      '  if (value > 17) return 17;',
      '  if (value > 18) return 18;',
      '  if (value > 19) return 19;',
      '  if (value > 20) return 20;',
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# changed\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'large commit candidate']);

  const report = await computePreflight(root, {
    mode: 'before_commit',
    baseRef: 'HEAD~1',
    headRef: 'HEAD',
    maxChangedFiles: 50,
  });

  expect(report.verdict).toBe('caution');
  expect(report.evidence.releaseScale).toEqual(
    expect.objectContaining({
      detected: true,
      changedFiles: expect.any(Number),
      threshold: 50,
      concreteBlockers: [],
    }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'review',
        severity: 'warning',
        message: expect.stringContaining('scale/complexity'),
      }),
    ]),
  );
  expect(report.requiredChecks.find((check) => check.name === 'review')?.status).toBe('warn');
}, 120_000);

test('before_merge treats scale-only review blocks as manual sign-off caution', async () => {
  const root = await makeTempProject();
  await git(root, ['init']);
  await git(root, ['config', 'user.email', 'agent@example.com']);
  await git(root, ['config', 'user.name', 'Agent']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);

  await fs.writeFile(
    path.join(root, 'src', 'index.ts'),
    [
      'export function complex(value: number) {',
      '  if (value > 1) return 1;',
      '  if (value > 2) return 2;',
      '  if (value > 3) return 3;',
      '  if (value > 4) return 4;',
      '  if (value > 5) return 5;',
      '  if (value > 6) return 6;',
      '  if (value > 7) return 7;',
      '  if (value > 8) return 8;',
      '  if (value > 9) return 9;',
      '  if (value > 10) return 10;',
      '  if (value > 11) return 11;',
      '  if (value > 12) return 12;',
      '  if (value > 13) return 13;',
      '  if (value > 14) return 14;',
      '  if (value > 15) return 15;',
      '  if (value > 16) return 16;',
      '  if (value > 17) return 17;',
      '  if (value > 18) return 18;',
      '  if (value > 19) return 19;',
      '  if (value > 20) return 20;',
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  );
  await fs.writeFile(path.join(root, 'README.md'), '# changed\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'large platform change']);

  const report = await computePreflight(root, {
    mode: 'before_merge',
    baseRef: 'HEAD~1',
    headRef: 'HEAD',
    maxChangedFiles: 1,
  });

  expect(report.verdict).toBe('caution');
  expect(report.evidence.releaseScale).toEqual(
    expect.objectContaining({
      detected: true,
      changedFiles: expect.any(Number),
      threshold: 1,
      concreteBlockers: [],
    }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'release',
        severity: 'warning',
        message: expect.stringContaining('Large platform release risk'),
      }),
      expect.objectContaining({
        source: 'review',
        severity: 'warning',
        message: expect.stringContaining('scale/complexity'),
      }),
    ]),
  );
  expect(report.evidence.releaseScale?.changedFiles).toBeGreaterThan(1);
  expect(report.summary).toContain('manual release sign-off');
  expect(report.summary).not.toContain('block:');
  expect(report.requiredChecks.find((check) => check.name === 'review')?.status).toBe('warn');
  expect(report.requiredChecks.find((check) => check.name === 'review')?.reason).toContain(
    'scale/complexity',
  );
}, 120_000);

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: root });
}
async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const abs = path.join(root, rel);
  const stat = await fs.stat(abs);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

async function writeMarkerPlugin(root: string, markerPath: string): Promise<void> {
  const pluginDir = path.join(root, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'marker.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'marker',
      kind: 'analyzer',
      module: './marker.mjs',
      category: 'policy',
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'marker.mjs'),
    `import { writeFile } from 'node:fs/promises';
await writeFile(${JSON.stringify(markerPath)}, 'executed');
export default {
  check: () => [{
    id: 'marker-policy',
    title: 'Marker policy',
    description: 'This should not execute unless the preview flag is already set.',
    severity: 'error',
    category: 'policy',
    fixAvailable: false,
  }],
};
`,
  );
}

async function writeErrorPlugin(root: string): Promise<void> {
  const pluginDir = path.join(root, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'policy.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'policy',
      kind: 'analyzer',
      module: './policy.mjs',
      category: 'policy',
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'policy.mjs'),
    `export default {
      check: () => [{
        id: 'blocked-pattern',
        title: 'Blocked fixture policy',
        description: 'Fixture policy issue from analyzer plugin.',
        severity: 'error',
        category: 'policy',
        fixAvailable: false,
        locations: [{ file: 'src/index.ts', line: 1 }],
      }],
    };`,
  );
}

test('preflight surfaces swarm-coordination evidence and a caution (not block) across worktrees', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-coord-'));
  tempRoots.push(root);
  const sibling = `${root}-wt`;
  tempRoots.push(sibling);
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 't@t.t'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: root });
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-qm', 'base'], { cwd: root });
  await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'agent-b', sibling], { cwd: root });
  // Same-file collision: both worktrees change src/a.ts.
  await fs.writeFile(path.join(root, 'src', 'a.ts'), 'export const a = 2;\n');
  await fs.writeFile(path.join(sibling, 'src', 'a.ts'), 'export const a = 3;\n');
  await execFileAsync('git', ['commit', '-qam', 'b'], { cwd: sibling });

  const report = await computePreflight(root, { mode: 'before_commit' });

  expect(report.evidence.coordination?.available).toBe(true);
  expect(report.evidence.coordination?.readiness).toBe('conflicted');
  expect(report.evidence.coordination?.collisions.high).toBeGreaterThanOrEqual(1);
  const coordReason = report.reasons.find((r) => r.source === 'coordination');
  expect(coordReason).toBeDefined();
  // Advisory only — coordination contributes a warning (caution), never an error/block.
  expect(coordReason?.severity).toBe('warning');

  await execFileAsync('git', ['worktree', 'remove', '--force', sibling], { cwd: root }).catch(
    () => {},
  );
});
