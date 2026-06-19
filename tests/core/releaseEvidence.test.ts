import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import {
  calibratePreflightTrust,
  computeEvidencePack,
  renderEvidencePackPrComment,
  validateEvidencePackPrComment,
} from '../../src/core/releaseEvidence.js';
import { buildEvidencePackArtifacts } from '../../src/core/releaseEvidenceArtifacts.js';
import type {
  BugHuntReport,
  EvidencePackReport,
  PreflightReport,
  ReleaseTrainReport,
  WorkplanReport,
} from '../../src/types.js';

const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('evidence pack composes the four-line product plan without changing package metadata', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeEvidencePack(root, {
    lines: ['2.3.x', '2.4.x', '2.5.x', '2.6.x'],
    includeWebsitePrompt: true,
    maxFindings: 4,
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as {
    version: string;
  };
  expect(pkg.version).toBe('2.2.0');
  expect(report.schemaVersion).toBe(1);
  expect(report.currentVersion).toBe('2.2.0');
  expect(report.readOnly).toBe(true);
  expect(report.train.lines).toEqual(['2.3.x', '2.4.x', '2.5.x', '2.6.x']);
  expect(report.artifacts.map((artifact) => artifact.id)).toEqual(
    expect.arrayContaining(['ep-release-train', 'ep-bug-hunt', 'ep-workplan', 'ep-preflight']),
  );
  expect(report.changelogEntries).toEqual(
    expect.arrayContaining([
      expect.stringContaining('projscan_evidence_pack'),
      expect.stringContaining('projscan_regression_plan'),
    ]),
  );
  expect(report.websitePrompt).toContain('projscan_evidence_pack');
  expect(report.approval.required).toBe(true);
  expect(report.approval.recommendation.length).toBeGreaterThan(0);
  expect(report.dailyPrWorkflow?.map((step) => step.id)).toEqual([
    'context',
    'gate',
    'fix_first',
    'review_packet',
    'feedback',
  ]);
  expect(report.dailyPrWorkflow?.map((step) => step.command)).toEqual(
    expect.arrayContaining([
      'projscan start --mode before_edit --format json',
      'projscan preflight --mode before_commit --format json',
      'projscan bug-hunt --format json',
      'projscan evidence-pack --pr-comment',
    ]),
  );
  expect(report.dailyPrWorkflow?.at(-1)?.command).toContain('projscan feedback add');
});

test('evidence pack can render a concise PR comment for GitHub review', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeEvidencePack(root, {
    includePrComment: true,
    maxFindings: 3,
  });

  expect(report.prComment).toContain('## projscan approval evidence');
  expect(report.prComment).toContain('**Verdict:**');
  expect(report.prComment).toContain('### Verdict');
  expect(report.prComment).toContain('### Reviewer Decision');
  expect(report.prComment).toContain('### Daily PR Workflow');
  expect(report.prComment).toContain('### Top Risks');
  expect(report.prComment).toContain('### Team Routing');
  expect(report.prComment).toContain('### Baseline Trend');
  expect(report.prComment).toContain('### Trust Calibration');
  expect(report.prComment).toContain('### Verification');
  expect(report.prComment).toContain('### Next Commands');
  expect(report.prComment).toContain('### Suggested Next Actions');
  expect(report.prComment).toContain('projscan preflight --mode before_merge --format json');
  expect(report.prComment).toContain('projscan start --mode before_edit --format json');
  expect(report.prComment).toContain('projscan bug-hunt --format json');
  expect(report.prComment).toContain('projscan evidence-pack --pr-comment');
  expect(report.prComment).toContain('projscan feedback add --file .projscan-feedback.json');
  expect(report.prSummary?.trust.summary).toMatch(/defect|manual review|clean/i);
  expect(report.prSummary?.nextCommands).toContain(
    'projscan preflight --mode before_merge --format json',
  );
  expect(report.prCommentValidation?.status).toBe('pass');
  expect(report.prCommentValidation?.checks.map((check) => check.id)).toEqual(
    expect.arrayContaining([
      'required-sections',
      'github-size',
      'render-sanity',
      'actionable-commands',
    ]),
  );
});

test('trust calibration treats release-scale review blocks as manual review', () => {
  const preflight: PreflightReport = {
    schemaVersion: 1,
    mode: 'before_merge',
    verdict: 'block',
    summary: 'block: 66 changed files exceeds the preflight threshold of 50',
    reasons: [
      {
        severity: 'warning',
        source: 'changed-files',
        message: '66 changed files exceeds the preflight threshold of 50',
        tool: 'projscan_review',
      },
      {
        severity: 'warning',
        source: 'release',
        message:
          'Large platform release risk: 66 changed files exceeds the preflight threshold of 50',
        tool: 'projscan_review',
      },
      {
        severity: 'error',
        source: 'review',
        message:
          'Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 199.2 (>= 80).',
        tool: 'projscan_review',
      },
    ],
    evidence: {
      releaseScale: {
        detected: true,
        changedFiles: 66,
        threshold: 50,
        reviewVerdict: 'block',
        reviewSummary: 'Maximum changed-file risk score is 199.2 (>= 80).',
        concreteBlockers: [],
        explanation:
          'Large platform release risk: 66 changed files exceeds the preflight threshold of 50',
      },
    },
    requiredChecks: [],
    suggestedNextActions: [],
    toolCalls: [],
  };

  const trust = calibratePreflightTrust(preflight);

  expect(trust.verdict).toBe('manual_review');
  expect(trust.concreteBlockers).toEqual([]);
  expect(trust.manualReviewSignals.join(' ')).toContain('Large platform release risk');
  expect(trust.summary).toContain('manual review');
});

test('evidence pack labels release-scale bug-hunt queues as sign-off actions', async () => {
  const root = await makeReleaseSignoffProject();

  const report = await computeEvidencePack(root, { maxFindings: 1 });
  const bugHuntArtifact = report.artifacts.find((artifact) => artifact.id === 'ep-bug-hunt');

  expect(bugHuntArtifact?.summary).toContain('manual sign-off action');
  expect(bugHuntArtifact?.evidence).toContain('1 manual sign-off action(s) in queue');
  expect(bugHuntArtifact?.evidence).not.toContain('1 fix target(s) in queue');
}, 120_000);

test('evidence pack tolerates legacy release-train readiness without action detail', () => {
  const artifacts = buildEvidencePackArtifacts(
    {
      schemaVersion: 1,
      currentVersion: '4.8.0',
      plan: { policy: 'product-readiness-plan', lines: ['4.9.x'], readOnly: true },
      readiness: {
        verdict: 'caution',
        blockers: 0,
        cautions: 1,
        summary: 'caution: review readiness cautions',
      },
      tracks: [],
      tasks: [],
      suggestedNextActions: [],
    } as ReleaseTrainReport,
    {
      verdict: 'clean',
      summary: 'clean',
      health: { score: 100 },
      fixQueue: [],
      evidence: { preflightVerdict: 'proceed' },
    } as BugHuntReport,
    {
      verdict: 'proceed',
      summary: 'proceed',
      tasks: [],
      topRisks: [],
      coordination: { recommendedNextAgent: 'none' },
    } as WorkplanReport,
    {
      verdict: 'proceed',
      summary: 'proceed',
      requiredChecks: [],
    } as unknown as PreflightReport,
  );

  const releaseTrainArtifact = artifacts.find((artifact) => artifact.id === 'ep-release-train');
  expect(releaseTrainArtifact?.evidence).toContain(
    'Review readiness cautions: projscan preflight --mode before_merge --format json',
  );
});

test('PR comments label manual release gates without actual-defect blocker wording', () => {
  const report: EvidencePackReport = {
    schemaVersion: 1,
    currentVersion: '3.0.3',
    readOnly: true,
    verdict: 'blocked',
    summary: 'blocked: Large platform release risk',
    train: {
      lines: ['3.0.x'],
      readiness: {
        verdict: 'block',
        blockers: 1,
        cautions: 0,
        summary: 'manual release sign-off required',
        action: {
          kind: 'manual-signoff',
          label: 'Manual release sign-off required',
          command: 'projscan preflight --mode before_merge --format json',
          detail:
            'Release-scale caution needs human sign-off; it is not a concrete defect blocker.',
        },
      },
    },
    approval: {
      required: true,
      recommendation: 'Do not approve launch until p0 evidence is cleared or accepted.',
      blockingReasons: [
        'Large platform release risk: 66 changed files exceeds the preflight threshold of 50',
        'Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 199.2 (>= 80).',
      ],
    },
    artifacts: [
      {
        id: 'ep-preflight',
        title: 'Preflight gate',
        status: 'blocked',
        summary: 'manual release sign-off required',
        evidence: ['review: fail'],
        commands: ['projscan preflight --mode before_merge --format json'],
      },
    ],
    changelogEntries: [],
    suggestedNextActions: [],
    prSummary: {
      verdictLabel: 'Manual review',
      decision: 'Scale or complexity needs human sign-off; no concrete defect blocker was found.',
      trust: {
        verdict: 'manual_review',
        summary: 'manual review signal; no actual defect blocker was found.',
        concreteBlockers: [],
        manualReviewSignals: ['Large platform release risk'],
        watchSignals: [],
      },
      topRisks: [],
      teamRoutes: [],
      nextCommands: ['projscan preflight --mode before_merge --format json'],
    },
  };

  const comment = renderEvidencePackPrComment(report);

  expect(comment).toContain('### Reviewer Decision');
  expect(comment).toContain('- decision: review');
  expect(comment).toContain('- manual gate: Large platform release risk');
  expect(comment).not.toContain('- blocker: Review verdict is block due to scale/complexity risk');
  expect(comment).toContain('Approval guidance: Require human release sign-off');
});

test('PR comment validator fails when the GitHub review surface loses required sections', async () => {
  const root = await makeTempProject('2.2.0');
  const report = await computeEvidencePack(root, {
    includePrComment: true,
    maxFindings: 3,
  });
  const broken = report.prComment!.replace('### Team Routing', '### Owners');
  const validation = validateEvidencePackPrComment(broken, report);

  expect(validation.status).toBe('fail');
  expect(validation.checks.find((check) => check.id === 'required-sections')?.summary).toContain(
    'Team Routing',
  );
});

test('PR comment validator fails when developer feedback is removed', async () => {
  const root = await makeTempProject('2.2.0');
  const report = await computeEvidencePack(root, {
    includePrComment: true,
    maxFindings: 3,
  });
  const broken = report.prComment!.replace('### Developer Feedback', '### Reviewer Notes');
  const validation = validateEvidencePackPrComment(broken, report);

  expect(validation.status).toBe('fail');
  expect(validation.checks.find((check) => check.id === 'required-sections')?.summary).toContain(
    'Developer Feedback',
  );
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-evidence-pack-'));
  tempRoots.push(root);
  await fs.writeFile(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version, type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, '.github'), { recursive: true });
  await fs.writeFile(path.join(root, '.github', 'CODEOWNERS'), 'src/** @platform-team\n');
  await fs.writeFile(
    path.join(root, '.projscan-baseline.json'),
    `${JSON.stringify({ score: 90, grade: 'A', issues: [], hotspots: [{ relativePath: 'src/index.ts', riskScore: 1, churn: 0 }], timestamp: '2026-05-01T00:00:00.000Z', issueRuleCounts: {} }, null, 2)}\n`,
  );
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function makeReleaseSignoffProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-evidence-signoff-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '2.2.0',
    type: 'module',
    devDependencies: { vitest: '^3.0.0' },
    eslintConfig: { root: true },
    prettier: {},
  });
  await fs.writeFile(
    path.join(root, 'README.md'),
    '# fixture\n\nA focused fixture with setup notes, usage examples, and verification guidance.\n',
  );
  await fs.writeFile(path.join(root, '.gitignore'), '.env\nnode_modules\n');
  await fs.writeFile(path.join(root, '.editorconfig'), 'root = true\n');
  await fs.mkdir(path.join(root, '.github'), { recursive: true });
  await fs.writeFile(path.join(root, '.github', 'CODEOWNERS'), 'src/** @platform-team\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'index.test.ts'), 'export const ok = true;\n');
  await git(root, ['init']);
  await git(root, ['config', 'user.email', 'agent@example.com']);
  await git(root, ['config', 'user.name', 'Agent']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);

  await fs.mkdir(path.join(root, '.agentflight'), { recursive: true });
  await writeJson(path.join(root, '.agentflight', 'config.json'), { localOnly: true });
  await fs.writeFile(
    path.join(root, 'src', 'index.ts'),
    [
      'export function complex(value: number) {',
      ...Array.from(
        { length: 90 },
        (_, index) => `  if (value > ${index + 1}) return ${index + 1};`,
      ),
      '  return 0;',
      '}',
      '',
    ].join('\n'),
  );
  return root;
}

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: root });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
