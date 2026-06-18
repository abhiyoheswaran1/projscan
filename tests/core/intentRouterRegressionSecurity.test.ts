import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent regression and security routing', () => {
  it('routes failing CI and test intents to the regression plan', () => {
    const result = routeIntent('CI is failing after this PR');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['ci', 'failing', 'pr'],
      }),
    );
  });

  it('routes direct CI fail questions to the regression plan before issue explanation', () => {
    const result = routeIntent('why did CI fail');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['ci', 'fail'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['why'],
      }),
    );
  });

  it('routes GitHub Actions failure questions to the regression plan before issue explanation', () => {
    const result = routeIntent('why is GitHub Actions failing');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['github', 'actions', 'failing']),
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['why'],
      }),
    );

    const job = routeIntent('which GitHub Actions job failed');
    expect(job.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['github', 'actions', 'job', 'failed']),
      }),
    );
  });

  it('routes slow CI builds and benchmark questions to regression planning', () => {
    const slowCi = routeIntent('why is CI slow');
    expect(slowCi.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: ['ci', 'slow'],
      }),
    );
    expect(slowCi.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['why'],
      }),
    );

    const slowBuilds = routeIntent('what is making builds slow');
    expect(slowBuilds.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['builds', 'slow'],
      }),
    );

    const benchmarks = routeIntent('what commands benchmark this repo');
    expect(benchmarks.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['commands', 'benchmark'],
      }),
    );
  });

  it('routes flaky and intermittent CI questions to regression planning', () => {
    const flakyCi = routeIntent('CI is flaky');
    expect(flakyCi.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: ['ci', 'flaky'],
      }),
    );

    const flakeRepro = routeIntent('what command reproduces the flake');
    expect(flakeRepro.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['command', 'reproduces', 'flake'],
      }),
    );

    const quarantine = routeIntent('quarantine flaky test');
    expect(quarantine.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['test', 'flaky', 'quarantine'],
      }),
    );

    const race = routeIntent('race condition in tests');
    expect(race.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['tests', 'race', 'condition'],
      }),
    );
  });

  it('routes build, lint, typecheck, install, and stack-trace failures to regression planning', () => {
    const build = routeIntent('why did the build fail');
    expect(build.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: ['fail', 'build'],
      }),
    );
    expect(build.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['why'],
      }),
    );

    const lint = routeIntent('lint is failing');
    expect(lint.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['failing', 'lint'],
      }),
    );
    expect(lint.matches.find((match) => match.tool === 'projscan_doctor')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['lint'],
      }),
    );

    expect(routeIntent('typecheck is failing').matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['failing', 'typecheck'],
      }),
    );

    const install = routeIntent('npm install is failing');
    expect(install.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['failing', 'install'],
      }),
    );
    expect(install.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['install'],
      }),
    );

    const installWarning = routeIntent('npm install -g projscan printed allow-scripts warnings');
    expect(installWarning.matches[0]).toEqual(
      expect.objectContaining({
        intent: 'Diagnose failing CI, tests, or local setup',
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['install', 'warnings']),
      }),
    );

    expect(routeIntent('debug this stack trace').matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['debug', 'stack', 'trace'],
      }),
    );
  });

  it('routes smoke-check verification intents to regression planning', () => {
    const result = routeIntent('what smoke checks should I run before commit');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['smoke', 'checks'],
      }),
    );
  });

  it('routes test-plan questions to verification planning before structural diffs', () => {
    const result = routeIntent('what tests should I run for my changes');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'tests']),
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['changes'],
      }),
    );
  });

  it('routes proof-command questions to focused regression planning', () => {
    const result = routeIntent('what commands prove this works');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['prove', 'commands', 'works'],
      }),
    );
  });

  it('routes proof-command shorthand to regression planning without hijacking reviewer proof', () => {
    const result = routeIntent('give me proof commands');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['proof', 'commands'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_evidence_pack')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['proof'],
      }),
    );

    const reviewerProof = routeIntent('write a PR comment for reviewers');
    expect(reviewerProof.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_evidence_pack',
        matchedKeywords: ['comment', 'reviewers', 'pr'],
      }),
    );
  });

  it('routes pre-push command questions to focused regression planning', () => {
    const result = routeIntent('what commands should I run before pushing');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['commands', 'pushing'],
      }),
    );
  });

  it('routes full regression intents to regression planning before merge gates', () => {
    const result = routeIntent('what full regression should I run before merge');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['regression', 'full'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_preflight')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['merge'],
      }),
    );
  });

  it('routes structural PR change questions to pr-diff before full review', () => {
    const result = routeIntent('what changed in this PR');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_pr_diff',
        cli: 'projscan pr-diff',
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['pr', 'changed'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_review')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.25,
        matchedKeywords: ['pr'],
      }),
    );

    const large = routeIntent('is this PR too large');
    expect(large.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_pr_diff',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['pr', 'large']),
      }),
    );

    const bigChange = routeIntent('how big is this change');
    expect(bigChange.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_pr_diff',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['big', 'change']),
      }),
    );
  });

  it('routes branch change questions to pr-diff without hijacking impact questions', () => {
    const result = routeIntent('what did I change since main');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_pr_diff',
        cli: 'projscan pr-diff',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['change', 'since', 'main'],
      }),
    );

    const impactQuestion = routeIntent('what breaks if I change src/core/start.ts');
    expect(impactQuestion.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'medium',
        matchedKeywords: ['breaks'],
      }),
    );
    expect(
      impactQuestion.matches.find((match) => match.tool === 'projscan_pr_diff'),
    ).toBeUndefined();
  });

  it('routes branch freshness and comparison questions to structural diff', () => {
    const stale = routeIntent('is my branch stale');

    expect(stale.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_pr_diff',
        cli: 'projscan pr-diff',
        confidence: 'high',
        matchedKeywords: ['branch', 'stale'],
      }),
    );

    const compare = routeIntent('compare my branch with main');
    expect(compare.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_pr_diff',
        cli: 'projscan pr-diff',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['branch', 'main', 'compare']),
      }),
    );
  });

  it('routes rebase and merge-conflict recovery to before-merge readiness', () => {
    const rebase = routeIntent('rebase went wrong');

    expect(rebase.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Safety gate',
        tool: 'projscan_preflight',
        cli: 'projscan preflight',
        confidence: 'high',
        matchedKeywords: ['rebase', 'wrong'],
      }),
    );

    const conflicts = routeIntent('resolve merge conflicts');
    expect(conflicts.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_preflight',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['merge', 'resolve', 'conflicts']),
      }),
    );

    const postConflictTests = routeIntent('what should I test after resolving conflicts');
    expect(postConflictTests.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['test'],
      }),
    );
  });

  it('routes incident and runtime failure language to a focused regression plan', () => {
    const outage = routeIntent('production is down');

    expect(outage.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: ['production', 'down'],
      }),
    );

    const incident = routeIntent('triage this incident');
    expect(incident.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['triage', 'incident'],
      }),
    );

    const statusCode = routeIntent('why is the login endpoint returning 500');
    expect(statusCode.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['returning', '500']),
      }),
    );

    const stackTrace = routeIntent('where is this stack trace from');
    expect(stackTrace.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['stack', 'trace'],
      }),
    );
  });

  it('keeps explicit error-message code lookup on search before incident triage', () => {
    const result = routeIntent('what code handles this error message');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        matchedKeywords: ['code', 'handles'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_regression_plan')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['error'],
      }),
    );
  });

  it('routes source-to-sink security questions to dataflow', () => {
    const result = routeIntent('is user input reaching SQL sinks');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Security',
        tool: 'projscan_dataflow',
        cli: 'projscan dataflow',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['sinks', 'sql'],
      }),
    );

    const secrets = routeIntent('does this endpoint expose secrets');
    expect(secrets.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: ['secrets', 'expose'],
      }),
    );

    const sanitized = routeIntent('is user input sanitized');
    expect(sanitized.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: ['sanitized'],
      }),
    );

    const exec = routeIntent('can request data reach exec');
    expect(exec.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: ['request', 'data', 'reach', 'exec'],
      }),
    );

    const bypass = routeIntent('find auth bypass risk');
    expect(bypass.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: ['auth', 'bypass'],
      }),
    );
  });

  it('routes security review wording for current changes to structural review', () => {
    const secureChange = routeIntent('is this change secure');

    expect(secureChange.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Review',
        tool: 'projscan_review',
        cli: 'projscan review',
        confidence: 'high',
        matchedKeywords: ['change', 'secure'],
      }),
    );

    const securityPr = routeIntent('check this PR for security issues');
    expect(securityPr.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_review',
        confidence: 'high',
        matchedKeywords: ['pr', 'security', 'issues', 'check'],
      }),
    );
    expect(securityPr.matches.find((match) => match.tool === 'projscan_dataflow')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['security'],
      }),
    );
  });
});
