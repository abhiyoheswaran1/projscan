import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent review and release routing', () => {
  it('routes exact-file coverage questions to file inspection without hijacking test search or run plans', () => {
    const covered = routeIntent('is src/core/start.ts covered by tests?');

    expect(covered.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['covered', 'tests'],
      }),
    );
    expect(covered.matches.find((match) => match.tool === 'projscan_regression_plan')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['tests'],
      }),
    );

    const coverage = routeIntent('does src/core/start.ts have test coverage?');
    expect(coverage.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['coverage', 'test'],
      }),
    );

    expect(routeIntent('where are the tests for src/core/start.ts?').matches[0].tool).toBe(
      'projscan_search',
    );
    expect(routeIntent('which tests should I run for src/core/start.ts?').matches[0].tool).toBe(
      'projscan_understand',
    );
  });

  it('routes exact-file test-authoring questions to file inspection without hijacking test search or run plans', () => {
    const addTests = routeIntent('what tests should I add for src/core/start.ts?');

    expect(addTests.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['add', 'tests'],
      }),
    );
    expect(addTests.matches.find((match) => match.tool === 'projscan_regression_plan')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['tests'],
      }),
    );

    const writeRegression = routeIntent(
      'what regression test should I write for src/core/start.ts?',
    );
    expect(writeRegression.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_file',
        confidence: 'high',
        matchedKeywords: ['write', 'test'],
      }),
    );

    const howToTest = routeIntent('how should I test src/core/start.ts?');
    expect(howToTest.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_file',
        confidence: 'high',
        matchedKeywords: ['test'],
      }),
    );

    expect(routeIntent('where are the tests for src/core/start.ts?').matches[0].tool).toBe(
      'projscan_search',
    );
    expect(routeIntent('which tests should I run for src/core/start.ts?').matches[0].tool).toBe(
      'projscan_understand',
    );
  });

  it('routes exact-file read-before-change questions to file inspection without hijacking repo orientation', () => {
    const result = routeIntent('what should I read before changing src/core/start.ts?');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['read'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['read'],
      }),
    );

    expect(routeIntent('what files should I read first?').matches[0].tool).toBe(
      'projscan_understand',
    );
    expect(routeIntent('what should I read before changing auth').matches[0].tool).toBe(
      'projscan_understand',
    );
  });

  it('routes "review my PR" to review', () => {
    const result = routeIntent('review my pull request');
    expect(result.matches[0].tool).toBe('projscan_review');
  });

  it('routes PR and branch risk questions to review without hijacking repo quality questions', () => {
    const prRisk = routeIntent('how risky is this PR');

    expect(prRisk.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_review',
        cli: 'projscan review',
        confidence: 'high',
        matchedKeywords: ['pr', 'risky'],
      }),
    );
    expect(prRisk.matches.find((match) => match.tool === 'projscan_quality_scorecard')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['risky'],
      }),
    );

    const risks = routeIntent('what are the risks in my PR');
    expect(risks.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_review',
        confidence: 'high',
        matchedKeywords: ['pr', 'risks'],
      }),
    );

    const branchRisk = routeIntent('how risky is my branch');
    expect(branchRisk.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_review',
        confidence: 'high',
        matchedKeywords: ['branch', 'risky'],
      }),
    );

    const riskyChanges = routeIntent('what are the risky changes in this PR');
    expect(riskyChanges.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_review',
        confidence: 'high',
        matchedKeywords: ['pr', 'changes', 'risky'],
      }),
    );

    expect(routeIntent('what is risky in this repo').matches[0].tool).toBe(
      'projscan_quality_scorecard',
    );
  });

  it('routes merge risk summaries to preflight instead of generic quality scorecards', () => {
    const result = routeIntent('what are the top risks before merge');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Safety gate',
        tool: 'projscan_preflight',
        cli: 'projscan preflight',
        confidence: 'high',
        matchedKeywords: ['merge', 'risks'],
      }),
    );
  });

  it('routes reviewer PR comment requests to evidence pack', () => {
    const result = routeIntent('write a PR comment for reviewers');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_evidence_pack',
        cli: 'projscan evidence-pack',
        confidence: 'high',
        score: 4.25,
        matchedKeywords: ['comment', 'reviewers', 'pr'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_review')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        matchedKeywords: ['pr'],
      }),
    );
  });

  it('routes shareable redacted evidence requests before generic repo understanding', () => {
    const result = routeIntent('share redacted evidence for src/api with a partner');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_analyze',
        cli: 'projscan analyze',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining([
          'share',
          'redacted',
          'evidence',
          'partner',
        ]),
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['api'],
      }),
    );
  });

  it('routes PR narrative requests to evidence pack without hijacking repo summaries', () => {
    const description = routeIntent('write a PR description');

    expect(description.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_evidence_pack',
        cli: 'projscan evidence-pack',
        confidence: 'high',
        matchedKeywords: ['description', 'pr'],
      }),
    );
    expect(
      description.matches.find((match) => match.tool === 'projscan_privacy_check'),
    ).toBeUndefined();

    const reviewerSummary = routeIntent('summarize my changes for reviewers');
    expect(reviewerSummary.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_evidence_pack',
        confidence: 'high',
        matchedKeywords: ['summarize', 'changes', 'reviewers'],
      }),
    );

    const prSay = routeIntent('what should my PR say?');
    expect(prSay.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_evidence_pack',
        confidence: 'high',
        matchedKeywords: ['say', 'pr'],
      }),
    );

    expect(routeIntent('summarize this repo').matches[0].tool).toBe('projscan_understand');
  });

  it('routes PR checklists and team-facing change summaries to evidence pack', () => {
    const checklist = routeIntent('make a PR checklist');

    expect(checklist.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_evidence_pack',
        cli: 'projscan evidence-pack',
        confidence: 'high',
        matchedKeywords: ['checklist', 'pr'],
      }),
    );

    const teamSummary = routeIntent('what should I tell my team about this change');
    expect(teamSummary.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_evidence_pack',
        confidence: 'high',
        matchedKeywords: ['tell', 'team', 'change'],
      }),
    );
    expect(teamSummary.matches.find((match) => match.tool === 'projscan_pr_diff')).toBeUndefined();
  });

  it('routes commit-message wording to structural diff evidence instead of privacy-check', () => {
    const result = routeIntent('write a commit message for these changes');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_pr_diff',
        cli: 'projscan pr-diff',
        confidence: 'high',
        matchedKeywords: ['commit', 'message', 'changes'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_privacy_check')).toBeUndefined();

    const summary = routeIntent('summarize my changes for a commit');
    expect(summary.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_pr_diff',
        cli: 'projscan pr-diff',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['commit', 'changes']),
      }),
    );
    expect(summary.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['summarize'],
      }),
    );
  });

  it('routes reviewer-owner questions to evidence pack without hijacking direct reviews', () => {
    const result = routeIntent('who should review this PR');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_evidence_pack',
        cli: 'projscan evidence-pack',
        confidence: 'high',
        score: 4.25,
        matchedKeywords: ['who', 'review', 'pr'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_review')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['review', 'pr'],
      }),
    );

    const directReview = routeIntent('review this PR for risk');
    expect(directReview.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_review',
        confidence: 'high',
        matchedKeywords: ['review', 'pr', 'risk'],
      }),
    );
  });

  it('routes exact-file reviewer questions to file inspection without hijacking PR reviewer routing', () => {
    const result = routeIntent('who should review src/core/start.ts?');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['review'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_evidence_pack')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['who', 'review'],
      }),
    );

    const reviewer = routeIntent('which reviewer should I ask for src/core/start.ts?');
    expect(reviewer.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['reviewer'],
      }),
    );

    expect(routeIntent('who should review this PR').matches[0].tool).toBe('projscan_evidence_pack');
  });

  it('routes changed-file owner questions to evidence pack without hijacking file ownership', () => {
    const result = routeIntent('who owns the changed files');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_evidence_pack',
        cli: 'projscan evidence-pack',
        confidence: 'high',
        score: 6,
        matchedKeywords: ['who', 'owns', 'changed', 'files'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['changed'],
      }),
    );

    const fileOwner = routeIntent('who owns src/core/start.ts');
    expect(fileOwner.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_file',
        matchedKeywords: ['owns'],
      }),
    );
    expect(
      fileOwner.matches.find((match) => match.tool === 'projscan_evidence_pack'),
    ).toBeUndefined();
    expect(fileOwner.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();
  });

  it('routes PR-readiness questions to evidence pack without hijacking releases', () => {
    const result = routeIntent('am I ready to open a PR');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_evidence_pack',
        cli: 'projscan evidence-pack',
        confidence: 'high',
        score: 4.25,
        matchedKeywords: ['ready', 'open', 'pr'],
      }),
    );

    const release = routeIntent('prepare this branch for release');
    expect(release.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        matchedKeywords: ['release', 'prepare'],
      }),
    );
    expect(
      release.matches.find((match) => match.tool === 'projscan_evidence_pack'),
    ).toBeUndefined();
  });

  it('routes release-readiness phrasings to release train before generic checks', () => {
    const check = routeIntent('what should I check before release');

    expect(check.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Release',
        tool: 'projscan_release_train',
        cli: 'projscan release-train',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['release', 'check'],
      }),
    );
    expect(check.matches.find((match) => match.tool === 'projscan_doctor')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['check'],
      }),
    );

    const releasing = routeIntent('what should I do before releasing');
    expect(releasing.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['releasing'],
      }),
    );

    const deploy = routeIntent('can I deploy this');
    expect(deploy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['deploy']),
      }),
    );

    const safeDeploy = routeIntent('is this safe to deploy');
    expect(safeDeploy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['deploy']),
      }),
    );
    expect(safeDeploy.matches.find((match) => match.tool === 'projscan_preflight')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['safe'],
      }),
    );

    const deployCheck = routeIntent('what should I check before deploy');
    expect(deployCheck.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['deploy', 'check']),
      }),
    );

    const deployment = routeIntent('prepare this branch for deployment');
    expect(deployment.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['deployment', 'prepare']),
      }),
    );

    const sinceRelease = routeIntent('what changed since last release');
    expect(sinceRelease.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_pr_diff',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['changed', 'since', 'release']),
      }),
    );
    expect(
      sinceRelease.matches.find((match) => match.tool === 'projscan_release_train'),
    ).toBeUndefined();
    expect(sinceRelease.matches.find((match) => match.tool === 'projscan_session')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['last', 'changed'],
      }),
    );

    const sinceDeploy = routeIntent('what changed since last deploy');
    expect(sinceDeploy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['changed', 'since', 'deploy']),
      }),
    );

    const health = routeIntent('run a health check');
    expect(health.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        matchedKeywords: ['health', 'check'],
      }),
    );
  });

  it('routes release-note and changelog drafting to release train without hijacking PR narratives', () => {
    const releaseNote = routeIntent('write a release note for this change');

    expect(releaseNote.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Release',
        tool: 'projscan_release_train',
        cli: 'projscan release-train',
        confidence: 'high',
        matchedKeywords: ['release', 'note', 'change'],
      }),
    );

    const changelog = routeIntent('draft changelog entry');
    expect(changelog.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: ['changelog', 'draft', 'entry'],
      }),
    );

    const releaseSummary = routeIntent('summarize this release');
    expect(releaseSummary.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: ['release', 'summarize'],
      }),
    );
    expect(releaseSummary.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['summarize'],
      }),
    );

    expect(routeIntent('write a PR description').matches[0].tool).toBe('projscan_evidence_pack');
    expect(routeIntent('summarize this repo').matches[0].tool).toBe('projscan_understand');
  });
});
