import { expect, test } from 'vitest';
import { computeStartReport } from '../../src/core/start.js';
import { makeTempProject } from '../helpers/startProject.js';

test('start report turns reviewer PR-comment requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'write a PR comment for reviewers',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('write a PR comment for reviewers');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['comment', 'reviewers', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.readyActions[0]).toEqual(report.missionControl.primaryAction);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
  expect(report.missionControl.proofCommands).toContain(
    'projscan preflight --mode before_commit --format json',
  );
});

test('start report turns PR risk questions into structural review', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'how risky is this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('how risky is this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_review',
      cli: 'projscan review',
      confidence: 'high',
      matchedKeywords: ['pr', 'risky'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan review --format json',
      tool: 'projscan_review',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural PR review reports a verdict and identifies any risk that needs owner follow-up.',
      'Review, preflight, or evidence-pack follow-up is chosen before the branch is handed to reviewers.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan review --format json');
});

test('start report turns merge risk summaries into merge preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what are the top risks before merge',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_preflight',
      confidence: 'high',
      matchedKeywords: ['merge', 'risks'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_merge --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_merge' },
    }),
  );
});

test('start report turns PR description requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'write a PR description',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('write a PR description');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['description', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns PR checklist requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'make a PR checklist',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['checklist', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns team-facing change summary requests into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what should I tell my team about this change',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['tell', 'team', 'change'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toBeUndefined();
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns reviewer-routing questions into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who should review this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('who should review this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['who', 'review', 'pr'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_review'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['review', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan evidence-pack --pr-comment');
});

test('start report turns changed-file owner questions into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'who owns the changed files',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['who', 'owns', 'changed', 'files'],
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_pr_diff'),
  ).toEqual(
    expect.objectContaining({
      matchedKeywords: ['changed'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
});

test('start report turns PR-readiness questions into an evidence pack', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'am I ready to open a PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_evidence_pack',
      confidence: 'high',
      matchedKeywords: ['ready', 'open', 'pr'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan evidence-pack --pr-comment',
      tool: 'projscan_evidence_pack',
      args: { pr_comment: true },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
      'The reviewer-facing comment is validated before it is shared or used for approval.',
    ]),
  );
});

test('start report turns shareable redacted evidence requests into scoped report controls', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'share redacted evidence for src/api with a partner',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('share redacted evidence for src/api with a partner');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_analyze',
      cli: 'projscan analyze',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['share', 'redacted', 'evidence', 'partner']),
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan analyze --report-scope src/api --redact-paths --format json',
      tool: 'projscan_analyze',
      args: { report_scope: 'src/api', redact_paths: true },
    }),
  );
  expect(report.missionControl.readyActions.map((action) => action.command)).toEqual([
    'projscan analyze --report-scope src/api --redact-paths --format json',
    'projscan doctor --report-scope src/api --redact-paths --format markdown',
    'projscan ci --report-scope src/api --redact-paths --format sarif',
  ]);
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The scoped analysis, health, and CI artifacts are generated with path redaction enabled before sharing outside the repo.',
      'The reviewer can correlate redacted-path-N labels without seeing raw repo structure.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain(
    'projscan ci --report-scope src/api --redact-paths --format sarif',
  );

  const noScope = await computeStartReport(root, {
    intent: 'share redacted evidence',
  });
  expect(noScope.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan analyze --report-scope <report-scope> --redact-paths --format json',
      args: { report_scope: '<report-scope>', redact_paths: true },
    }),
  );
  expect(noScope.missionControl.unresolvedInputs).toContainEqual(
    expect.objectContaining({
      name: 'report_scope',
      instruction:
        'Replace <report-scope> with one or more comma-separated repo-relative paths to include in the shared evidence.',
    }),
  );
});

test('start report turns PR change questions into a structural diff action', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what changed in this PR',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what changed in this PR');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_pr_diff',
      confidence: 'high',
      matchedKeywords: ['pr', 'changed'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
      'The developer knows which changed files or symbols need deeper review.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan pr-diff --format json');

  const large = await computeStartReport(root, {
    intent: 'is this PR too large',
  });
  expect(large.mode).toBe('before_commit');
  expect(large.modeSource).toBe('intent');
  expect(large.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      tool: 'projscan_pr_diff',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['pr', 'large']),
    }),
  );
  expect(large.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
});

test('start report turns branch change questions into a structural diff action', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'what did I change since main',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('what did I change since main');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: ['change', 'since', 'main'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
      'The developer knows which changed files or symbols need deeper review.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan pr-diff --format json');
});

test('start report turns branch freshness questions into structural diff evidence', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'is my branch stale',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: ['branch', 'stale'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
});

test('start report turns rebase recovery into before-merge preflight', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'rebase went wrong',
  });

  expect(report.mode).toBe('before_merge');
  expect(report.modeSource).toBe('intent');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Safety gate',
      tool: 'projscan_preflight',
      cli: 'projscan preflight',
      confidence: 'high',
      matchedKeywords: ['rebase', 'wrong'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan preflight --mode before_merge --format json',
      tool: 'projscan_preflight',
      args: { mode: 'before_merge' },
    }),
  );
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'projscan preflight --mode before_merge returns proceed or only documented manual-review items.',
    ]),
  );
});

test('start report turns commit-message requests into structural diff evidence', async () => {
  const root = await makeTempProject();

  const report = await computeStartReport(root, {
    intent: 'write a commit message for these changes',
  });

  expect(report.mode).toBe('before_commit');
  expect(report.modeSource).toBe('intent');
  expect(report.modeReason).toContain('write a commit message for these changes');
  expect(report.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: ['commit', 'message', 'changes'],
    }),
  );
  expect(report.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
  expect(
    report.missionControl.alternatives?.find((route) => route.tool === 'projscan_privacy_check'),
  ).toBeUndefined();
  expect(report.missionControl.successCriteria).toEqual(
    expect.arrayContaining([
      'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
      'The developer knows which changed files or symbols need deeper review.',
    ]),
  );
  expect(report.missionControl.proofCommands).toContain('projscan pr-diff --format json');

  const summary = await computeStartReport(root, {
    intent: 'summarize my changes for a commit',
  });

  expect(summary.mode).toBe('before_commit');
  expect(summary.modeSource).toBe('intent');
  expect(summary.modeReason).toContain('summarize my changes for a commit');
  expect(summary.missionControl.routedIntent).toEqual(
    expect.objectContaining({
      category: 'Review',
      tool: 'projscan_pr_diff',
      cli: 'projscan pr-diff',
      confidence: 'high',
      matchedKeywords: expect.arrayContaining(['commit', 'changes']),
    }),
  );
  expect(summary.missionControl.primaryAction).toEqual(
    expect.objectContaining({
      command: 'projscan pr-diff --format json',
      tool: 'projscan_pr_diff',
      args: {},
    }),
  );
});
