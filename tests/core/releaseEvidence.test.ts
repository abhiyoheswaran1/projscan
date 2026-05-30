import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { calibratePreflightTrust, computeEvidencePack, renderEvidencePackPrComment, validateEvidencePackPrComment } from '../../src/core/releaseEvidence.js';
import type { EvidencePackReport, PreflightReport } from '../../src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('evidence pack composes the four-line product plan without changing package metadata', async () => {
  const root = await makeTempProject('2.2.0');

  const report = await computeEvidencePack(root, {
    lines: ['2.3.x', '2.4.x', '2.5.x', '2.6.x'],
    includeWebsitePrompt: true,
    maxFindings: 4,
  });

  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as { version: string };
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
  expect(report.prComment).toContain('### Top Risks');
  expect(report.prComment).toContain('### Team Routing');
  expect(report.prComment).toContain('### Baseline Trend');
  expect(report.prComment).toContain('### Trust Calibration');
  expect(report.prComment).toContain('### Verification');
  expect(report.prComment).toContain('### Next Commands');
  expect(report.prComment).toContain('### Suggested Next Actions');
  expect(report.prComment).toContain('projscan preflight --mode before_merge --format json');
  expect(report.prSummary?.trust.summary).toMatch(/defect|manual review|clean/i);
  expect(report.prSummary?.nextCommands).toContain('projscan preflight --mode before_merge --format json');
  expect(report.prCommentValidation?.status).toBe('pass');
  expect(report.prCommentValidation?.checks.map((check) => check.id)).toEqual(
    expect.arrayContaining(['required-sections', 'github-size', 'render-sanity', 'actionable-commands']),
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
        message: 'Large platform release risk: 66 changed files exceeds the preflight threshold of 50',
        tool: 'projscan_review',
      },
      {
        severity: 'error',
        source: 'review',
        message: 'Review verdict is block due to scale/complexity risk: Maximum changed-file risk score is 199.2 (>= 80).',
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
        explanation: 'Large platform release risk: 66 changed files exceeds the preflight threshold of 50',
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


test('PR comments label manual release gates without actual-defect blocker wording', () => {
  const report: EvidencePackReport = {
    schemaVersion: 1,
    currentVersion: '3.0.3',
    readOnly: true,
    verdict: 'blocked',
    summary: 'blocked: Large platform release risk',
    train: {
      lines: ['3.0.x'],
      readiness: { verdict: 'block', blockers: 1, cautions: 0, summary: 'manual release sign-off required' },
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
  expect(validation.checks.find((check) => check.id === 'required-sections')?.summary).toContain('Team Routing');
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
  expect(validation.checks.find((check) => check.id === 'required-sections')?.summary).toContain('Developer Feedback');
});

async function makeTempProject(version: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-evidence-pack-'));
  tempRoots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', version, type: 'module' }, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, '.github'), { recursive: true });
  await fs.writeFile(path.join(root, '.github', 'CODEOWNERS'), 'src/** @platform-team\n');
  await fs.writeFile(path.join(root, '.projscan-baseline.json'), `${JSON.stringify({ score: 90, grade: 'A', issues: [], hotspots: [{ relativePath: 'src/index.ts', riskScore: 1, churn: 0 }], timestamp: '2026-05-01T00:00:00.000Z', issueRuleCounts: {} }, null, 2)}\n`);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}
