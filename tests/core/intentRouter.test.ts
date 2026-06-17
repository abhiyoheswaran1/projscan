import { describe, expect, it } from 'vitest';
import { routeIntent, ROUTE_CATALOG } from '../../src/core/intentRouter.js';

describe('routeIntent', () => {
  it('routes read-first orientation questions to repo understanding instead of bug hunt', () => {
    const result = routeIntent('what files should I read first');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['read'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['first'],
      }),
    );
  });

  it('routes risky-file touch questions to hotspots before broad quality views', () => {
    const result = routeIntent('what files are risky to touch');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Hotspots',
        tool: 'projscan_hotspots',
        cli: 'projscan hotspots',
        confidence: 'high',
        score: 5,
        matchedKeywords: ['risky', 'files', 'touch'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_quality_scorecard')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['risky'],
      }),
    );
  });

  it('routes complexity and refactor focus questions to hotspots', () => {
    const complexFiles = routeIntent('which files are too complex');

    expect(complexFiles.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Hotspots',
        tool: 'projscan_hotspots',
        cli: 'projscan hotspots',
        confidence: 'high',
        matchedKeywords: ['files', 'complex'],
      }),
    );

    const refactorFirst = routeIntent('what file should I refactor first');
    expect(refactorFirst.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Hotspots',
        tool: 'projscan_hotspots',
        cli: 'projscan hotspots',
        confidence: 'high',
        matchedKeywords: ['file', 'refactor'],
      }),
    );
    expect(refactorFirst.matches.find((match) => match.tool === 'projscan_file')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['file'],
      }),
    );
  });

  it('routes performance and optimization focus questions to hotspots', () => {
    const bottlenecks = routeIntent('find performance bottlenecks');
    expect(bottlenecks.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Hotspots',
        tool: 'projscan_hotspots',
        cli: 'projscan hotspots',
        confidence: 'high',
        matchedKeywords: ['performance', 'bottlenecks'],
      }),
    );

    const optimize = routeIntent('what can I optimize');
    expect(optimize.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['optimize'],
      }),
    );

    const faster = routeIntent('make this code faster');
    expect(faster.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['faster'],
      }),
    );

    const slowFiles = routeIntent('where are the slow files');
    expect(slowFiles.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['files', 'where', 'slow'],
      }),
    );
  });

  it('routes repo summary questions to cited repo understanding', () => {
    const result = routeIntent('summarize this repo');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['summarize'],
      }),
    );
  });

  it('routes first-time codebase orientation phrasing to cited repo understanding', () => {
    const start = routeIntent('where do I start in this codebase');

    expect(start.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: ['codebase', 'start'],
      }),
    );
    expect(start.matches.find((match) => match.tool === 'projscan_hotspots')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['where', 'start'],
      }),
    );

    const first = routeIntent('what should I look at first');
    expect(first.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['look', 'first'],
      }),
    );
    expect(first.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['first'],
      }),
    );

    const tour = routeIntent('give me a tour of the repo');
    expect(tour.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['repo', 'tour'],
      }),
    );

    const entrypoints = routeIntent('show me the main entrypoints');
    expect(entrypoints.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['main', 'entrypoints'],
      }),
    );

    const important = routeIntent('what are the important files');
    expect(important.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['important'],
      }),
    );

    const walkthrough = routeIntent('walk me through the codebase');
    expect(walkthrough.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['codebase', 'walk', 'through'],
      }),
    );

    const entryPoint = routeIntent('where is the app entry point');
    expect(entryPoint.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['entry', 'point', 'app'],
      }),
    );

    expect(routeIntent('what is the fastest safe fix').matches[0].tool).toBe('projscan_bug_hunt');
  });

  it('routes architecture explanations to repo understanding instead of file or issue explanation', () => {
    const result = routeIntent('explain the architecture');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['architecture'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_file')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['explain'],
      }),
    );
  });

  it('routes public contract questions to repo understanding', () => {
    const result = routeIntent('what are the public contracts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['contracts', 'public'],
      }),
    );
  });

  it('routes project setup and run questions to repo understanding instead of hotspots', () => {
    const runProject = routeIntent('how do I run this project');
    expect(runProject.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: ['run', 'project'],
      }),
    );
    expect(runProject.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();

    const devServer = routeIntent('what command starts the dev server');
    expect(devServer.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['command', 'dev', 'server'],
      }),
    );
    expect(devServer.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();

    const localSetup = routeIntent('how do I set up this repo locally');
    expect(localSetup.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['set', 'locally'],
      }),
    );

    const npmScripts = routeIntent('what npm scripts exist');
    expect(npmScripts.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['npm', 'scripts']),
      }),
    );
    expect(npmScripts.matches.find((match) => match.tool === 'projscan_outdated')).toBeUndefined();

    const e2eScript = routeIntent('which script runs e2e tests');
    expect(e2eScript.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['script', 'runs', 'tests']),
      }),
    );
    expect(
      e2eScript.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const lintCommand = routeIntent('what command runs lint');
    expect(lintCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['command', 'runs', 'lint']),
      }),
    );
    expect(
      lintCommand.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const typecheckCommand = routeIntent('how do I run typecheck');
    expect(typecheckCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'typecheck']),
      }),
    );

    const storybookCommand = routeIntent('how do I run storybook');
    expect(storybookCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'storybook']),
      }),
    );
    expect(
      storybookCommand.matches.find((match) => match.tool === 'projscan_search'),
    ).toBeUndefined();

    const cypressCommand = routeIntent('how do I run cypress tests');
    expect(cypressCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'cypress', 'tests']),
      }),
    );
    expect(
      cypressCommand.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const playwrightCommand = routeIntent('which script runs playwright tests');
    expect(playwrightCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['script', 'runs', 'playwright', 'tests']),
      }),
    );

    const eslintCommand = routeIntent('how do I run eslint');
    expect(eslintCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'eslint']),
      }),
    );

    const prettierCommand = routeIntent('what command runs prettier');
    expect(prettierCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['command', 'runs', 'prettier']),
      }),
    );

    const formatCommand = routeIntent('which script runs format');
    expect(formatCommand.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['script', 'runs', 'format']),
      }),
    );

    expect(routeIntent('e2e tests are failing').matches[0].tool).toBe('projscan_regression_plan');
    expect(routeIntent('lint is failing').matches[0].tool).toBe('projscan_regression_plan');
    expect(routeIntent('cypress tests are failing').matches[0].tool).toBe(
      'projscan_regression_plan',
    );

    const seedDatabase = routeIntent('how do I seed the database');
    expect(seedDatabase.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['seed', 'database']),
      }),
    );
    expect(seedDatabase.matches.find((match) => match.tool === 'projscan_search')).toBeUndefined();

    const resetDatabase = routeIntent('what command resets the database');
    expect(resetDatabase.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['command', 'resets', 'database']),
      }),
    );

    const runMigrations = routeIntent('what command runs migrations');
    expect(runMigrations.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['command', 'runs', 'migrations']),
      }),
    );

    const migrationsLocally = routeIntent('how do I run migrations locally');
    expect(migrationsLocally.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'migrations', 'locally']),
      }),
    );

    expect(routeIntent('where is seed data defined').matches[0].tool).toBe('projscan_search');
  });

  it('routes feature placement and change-planning questions to repo understanding instead of search', () => {
    const feature = routeIntent('where should I put this new feature');
    expect(feature.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: ['feature', 'put'],
      }),
    );
    expect(feature.matches.find((match) => match.tool === 'projscan_search')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['where'],
      }),
    );

    const endpoint = routeIntent('where should I add a new endpoint');
    expect(endpoint.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['endpoint'],
      }),
    );

    const button = routeIntent('where should I add this button');
    expect(button.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['button'],
      }),
    );

    const authChange = routeIntent('what files do I need to change for auth');
    expect(authChange.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['need', 'change', 'files'],
      }),
    );

    const oauth = routeIntent('implement OAuth login');
    expect(oauth.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['implement', 'login'],
      }),
    );

    const settingsPage = routeIntent('build a settings page');
    expect(settingsPage.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['build', 'page'],
      }),
    );

    const webhook = routeIntent('add billing webhook support');
    expect(webhook.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['add', 'webhook', 'support'],
      }),
    );

    const checkout = routeIntent('wire up Stripe checkout');
    expect(checkout.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['wire', 'checkout'],
      }),
    );

    expect(routeIntent('add tests for auth').matches[0].tool).toBe('projscan_regression_plan');
  });

  it('routes documentation update planning to change-readiness understanding', () => {
    const docsUpdate = routeIntent('what docs should I update for this change');
    expect(docsUpdate.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: ['change', 'docs', 'update'],
      }),
    );
    expect(docsUpdate.matches.find((match) => match.tool === 'projscan_upgrade')).toBeUndefined();

    const needDocs = routeIntent('does this change need docs');
    expect(needDocs.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['need', 'change', 'docs'],
      }),
    );
  });

  it('routes database migration placement to change-readiness understanding', () => {
    const migration = routeIntent('where should I add this database migration');
    expect(migration.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: ['database', 'migration'],
      }),
    );
    expect(migration.matches.find((match) => match.tool === 'projscan_search')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['where'],
      }),
    );
  });

  it('routes API deprecation and breakage questions to contract and impact workflows', () => {
    const deprecate = routeIntent('how do I safely deprecate this API');

    expect(deprecate.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['api', 'deprecate']),
      }),
    );
    expect(deprecate.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['api', 'deprecate']),
      }),
    );

    const breakingChange = routeIntent('what will this API change break');
    expect(breakingChange.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['api', 'change', 'break']),
      }),
    );
    expect(breakingChange.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['api', 'change']),
      }),
    );
  });

  it('routes documentation lookup questions to search', () => {
    const docs = routeIntent('find documentation for auth');
    expect(docs.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        matchedKeywords: ['find', 'documentation'],
      }),
    );

    const documented = routeIntent('where is the API documented');
    expect(documented.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: ['where', 'documented'],
      }),
    );
  });

  it('routes repo env-var requirement questions to contracts without weakening explicit privacy questions', () => {
    const envRequirements = routeIntent('what env vars does this repo need');
    expect(envRequirements.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: ['env', 'vars'],
      }),
    );
    expect(
      envRequirements.matches.find((match) => match.tool === 'projscan_privacy_check'),
    ).toBeUndefined();

    expect(routeIntent('does projscan read .env values?').matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_privacy_check',
        matchedKeywords: expect.arrayContaining(['read', 'env']),
      }),
    );
  });

  it('routes coordination intents to the swarm tools', () => {
    const result = routeIntent('coordinate parallel agents working the same repo');
    const tools = result.matches.map((m) => m.tool);
    expect(tools).toContain('projscan_collision');
  });

  it('routes coordination status questions to the one-call swarm report first', () => {
    const result = routeIntent('show coordination status for parallel agents');
    const collision = result.matches.find((match) => match.tool === 'projscan_collision');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_coordinate',
        cli: 'projscan coordinate',
        confidence: 'high',
        matchedKeywords: ['coordination', 'status', 'parallel', 'agents'],
      }),
    );
    expect(collision).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['coordination', 'parallel', 'agents']),
      }),
    );
    expect(result.matches[0].score).toBeGreaterThan(collision?.score ?? 0);
  });

  it('routes who-else-is-working questions to the one-call coordination report', () => {
    const result = routeIntent('who else is working on this');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_coordinate',
        cli: 'projscan coordinate',
        confidence: 'high',
        score: 6,
        matchedKeywords: ['who', 'else', 'working'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();
  });

  it('routes collision and active-worktree wording to the right swarm surfaces', () => {
    const collide = routeIntent('am I going to collide with another agent');

    expect(collide.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_coordinate',
        cli: 'projscan coordinate',
        confidence: 'high',
        matchedKeywords: ['agent', 'collide'],
      }),
    );
    expect(collide.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['agent'],
      }),
    );

    const active = routeIntent('what worktrees are active');
    expect(active.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coordinate',
        confidence: 'high',
        matchedKeywords: ['worktrees', 'active'],
      }),
    );

    const editing = routeIntent('who is editing auth right now');
    expect(editing.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coordinate',
        confidence: 'high',
        matchedKeywords: ['who', 'editing'],
      }),
    );
  });

  it('routes merge-order shorthand away from bug-hunt first-fix wording', () => {
    const mergeFirst = routeIntent('what should merge first');

    expect(mergeFirst.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_merge_risk',
        cli: 'projscan merge-risk',
        confidence: 'high',
        matchedKeywords: ['merge', 'first'],
      }),
    );
    expect(mergeFirst.matches.find((match) => match.tool === 'projscan_bug_hunt')).toBeUndefined();

    const branchFirst = routeIntent('which branch should merge first');
    expect(branchFirst.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_merge_risk',
        confidence: 'high',
        matchedKeywords: ['merge', 'first', 'branch'],
      }),
    );
  });

  it('routes overlapping change questions to collision detection before generic PR diff', () => {
    const result = routeIntent('show me overlapping changes');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_collision',
        cli: 'projscan collisions',
        confidence: 'high',
        matchedKeywords: ['overlapping', 'changes'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['changes'],
      }),
    );
  });

  it('routes "is it safe to commit" to preflight', () => {
    const result = routeIntent('is it safe to commit this change');
    expect(result.matches[0].tool).toBe('projscan_preflight');
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['safe', 'commit'],
      }),
    );
  });

  it('routes quick-win and low-risk improvement wording to bug hunt', () => {
    const quickWin = routeIntent('find a quick win');

    expect(quickWin.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        matchedKeywords: ['quick', 'find', 'win'],
      }),
    );

    const lowRisk = routeIntent('what is a low risk improvement');
    expect(lowRisk.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['low', 'improvement'],
      }),
    );
    expect(lowRisk.matches.find((match) => match.tool === 'projscan_quality_scorecard')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['risk'],
      }),
    );

    const smallTask = routeIntent('pick a small safe task');
    expect(smallTask.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['small', 'task'],
      }),
    );

    const tenMinutes = routeIntent('what can I improve in 10 minutes');
    expect(tenMinutes.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['improve', 'minutes'],
      }),
    );

    const lowestFix = routeIntent('what is the lowest risk fix');
    expect(lowestFix.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['lowest', 'fix'],
      }),
    );
  });

  it('routes broad improve next wording to bug hunt without stealing technical improve next intents', () => {
    const improveNext = routeIntent('what should we improve next');

    expect(improveNext.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        matchedKeywords: ['improve'],
      }),
    );

    const testImprovement = routeIntent('what should we improve next in tests');
    expect(testImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: ['tests'],
      }),
    );

    const performanceImprovement = routeIntent('what should we improve next in performance');
    expect(performanceImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['performance'],
      }),
    );

    const releaseImprovement = routeIntent('what should we improve next before release');
    expect(releaseImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_release_train',
        matchedKeywords: ['release'],
      }),
    );

    const dependencyImprovement = routeIntent('what should we improve next for dependencies');
    expect(dependencyImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: ['dependencies'],
      }),
    );

    const safetyImprovement = routeIntent('what should we improve next for safety');
    expect(safetyImprovement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_preflight',
        matchedKeywords: ['safety'],
      }),
    );
  });

  it('does not treat prohibited release actions as the requested route', () => {
    const result = routeIntent(
      'continue autonomous no-release roadmap validation implementation; do not release publish tag push merge deploy or bump version',
    );

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workplan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['do', 'roadmap']),
      }),
    );
    expect(result.matches.slice(0, 3).map((match) => match.tool)).not.toContain(
      'projscan_release_train',
    );
    expect(result.matches.slice(0, 3).map((match) => match.tool)).not.toContain(
      'projscan_upgrade',
    );
  });

  it('routes product-planning wording to high-confidence workplan', () => {
    const buildNext = routeIntent('what should we build next');

    expect(buildNext.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_workplan',
        cli: 'projscan workplan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['build', 'next']),
      }),
    );
    expect(buildNext.matches[0]?.matchedKeywords).not.toEqual(['next']);

    const roadmap = routeIntent('plan the product roadmap');
    expect(roadmap.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workplan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['plan', 'product', 'roadmap']),
      }),
    );
  });

  it('keeps bug-hunt route metadata on action-queue wording', () => {
    const result = routeIntent('what should I fix first?');
    const bugHunt = result.matches[0];

    expect(bugHunt).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        what: expect.stringContaining('Ranked action queue'),
      }),
    );
    expect(bugHunt?.what).not.toContain('fix queue');
  });

  it('routes blocker-discovery questions to preflight before weak PR matches', () => {
    const result = routeIntent('what is blocking this PR');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Safety gate',
        tool: 'projscan_preflight',
        cli: 'projscan preflight',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['blocking'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_review')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.25,
        matchedKeywords: ['pr'],
      }),
    );

    const generic = routeIntent('what blockers are there');
    expect(generic.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_preflight',
        matchedKeywords: ['blockers'],
      }),
    );
  });

  it('routes merge-readiness questions to preflight without hijacking PR readiness', () => {
    const result = routeIntent('is my branch ready to merge');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Safety gate',
        tool: 'projscan_preflight',
        cli: 'projscan preflight',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['merge', 'ready'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_merge_risk')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['merge'],
      }),
    );

    const prReadiness = routeIntent('am I ready to open a PR');
    expect(prReadiness.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_evidence_pack',
        matchedKeywords: ['ready', 'open', 'pr'],
      }),
    );
    expect(
      prReadiness.matches.find((match) => match.tool === 'projscan_preflight'),
    ).toBeUndefined();
  });

  it('routes quality and risk picture questions to the scorecard', () => {
    const result = routeIntent('what is risky in this repo');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Health',
        tool: 'projscan_quality_scorecard',
        cli: 'projscan quality-scorecard',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['risky'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_preflight')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['risky'],
      }),
    );
  });

  it('routes dead-code cleanup questions to doctor', () => {
    const result = routeIntent('find dead code and unused exports I can delete');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Health',
        tool: 'projscan_doctor',
        cli: 'projscan doctor',
        confidence: 'high',
        score: 5,
        matchedKeywords: ['dead', 'unused'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        score: 2,
        matchedKeywords: ['delete'],
      }),
    );

    const deadCode = routeIntent('find dead code');
    expect(deadCode.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        confidence: 'high',
        matchedKeywords: ['dead'],
      }),
    );
    expect(deadCode.matches.find((match) => match.tool === 'projscan_search')).toBeUndefined();

    const unusedExports = routeIntent('find unused exports');
    expect(unusedExports.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['unused'],
      }),
    );
  });

  it('includes route confidence metadata for bug-fix intents', () => {
    const result = routeIntent('find bugs to fix before the PR');
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        score: 2.75,
        matchedKeywords: ['bugs', 'find', 'fix', 'pr'],
      }),
    );
  });

  it('routes first-fix prioritization intents to bug hunt instead of issue-specific fix suggest', () => {
    const result = routeIntent('what should I fix first');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['first', 'fix'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_fix_suggest')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['fix'],
      }),
    );
  });

  it('routes fastest safe fix questions to bug-hunt before generic preflight', () => {
    const result = routeIntent('what is the fastest safe fix');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        score: 2.25,
        matchedKeywords: ['fastest', 'fix'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_preflight')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['safe'],
      }),
    );
  });

  it('routes next-agent handoff requests to the agent brief', () => {
    const result = routeIntent('give the next agent a handoff');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_agent_brief',
        cli: 'projscan agent-brief',
        confidence: 'high',
        score: 5,
        matchedKeywords: ['handoff', 'next', 'agent'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_workplan')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['next'],
      }),
    );
  });

  it('routes open-ended next-step questions to a high-confidence workplan', () => {
    const result = routeIntent('what should I do next');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_workplan',
        cli: 'projscan workplan',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['do', 'next'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['next'],
      }),
    );
  });

  it('routes session resume questions to the touched-file session view', () => {
    const result = routeIntent('what did the last agent touch');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['touch', 'last'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['agent'],
      }),
    );
  });

  it('routes leave-off resume questions to session context instead of generic where tools', () => {
    const result = routeIntent('where did I leave off');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['leave', 'off'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();
  });

  it('routes changed-while-away questions to session context instead of PR diff', () => {
    const result = routeIntent('what changed while I was away');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['changed', 'away'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['changed'],
      }),
    );

    const offline = routeIntent('what changed while I was offline');
    expect(offline.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_session',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['changed', 'offline']),
      }),
    );
    expect(
      offline.matches.find((match) => match.tool === 'projscan_privacy_check'),
    ).toBeUndefined();
  });

  it('routes wake-up and last-agent status questions to session context', () => {
    const asleep = routeIntent('what changed while I was asleep');

    expect(asleep.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_session',
        cli: 'projscan session',
        confidence: 'high',
        matchedKeywords: ['changed', 'asleep'],
      }),
    );
    expect(asleep.matches.find((match) => match.tool === 'projscan_pr_diff')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['changed'],
      }),
    );

    const lastAgent = routeIntent('what did the last agent do');
    expect(lastAgent.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_session',
        confidence: 'high',
        matchedKeywords: ['last', 'agent'],
      }),
    );
    expect(lastAgent.matches.find((match) => match.tool === 'projscan_agent_brief')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['agent'],
      }),
    );
  });

  it('routes explicit issue-fix intents to fix-suggest instead of bug hunt', () => {
    const result = routeIntent('fix issue missing-test-framework');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_fix_suggest',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['fix', 'issue'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.25,
        matchedKeywords: ['fix'],
      }),
    );
  });

  it('routes explicit issue-explanation intents to explain-issue before fix-suggest', () => {
    const result = routeIntent('explain issue missing-test-framework');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_explain_issue',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['explain', 'issue'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_fix_suggest')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['issue'],
      }),
    );
  });

  it('keeps generic PR/template lookup intents on search instead of bug hunt', () => {
    const result = routeIntent('find the PR template');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['find'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.5,
        matchedKeywords: ['find', 'pr'],
      }),
    );
  });

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

  it('routes file explanation intents to file inspection', () => {
    const result = routeIntent('explain src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['explain'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_start')).toBeUndefined();
  });

  it('routes exact-file risk questions to file inspection without hijacking broad risk questions', () => {
    const risky = routeIntent('why is src/core/start.ts risky?');

    expect(risky.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['risky'],
      }),
    );
    expect(risky.matches.find((match) => match.tool === 'projscan_quality_scorecard')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['risky'],
      }),
    );

    const risks = routeIntent('what risks are in src/core/start.ts?');
    expect(risks.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['risks'],
      }),
    );

    expect(routeIntent('what is risky in this repo?').matches[0].tool).toBe(
      'projscan_quality_scorecard',
    );
    expect(routeIntent('what files are risky to touch?').matches[0].tool).toBe('projscan_hotspots');
  });

  it('routes file ownership questions to file inspection instead of claims', () => {
    const result = routeIntent('who owns src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['owns'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();
  });

  it('routes area ownership lookup to search instead of advisory claims', () => {
    const auth = routeIntent('who owns auth');
    expect(auth.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['owns']),
      }),
    );
    expect(auth.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const team = routeIntent('which team owns payments');
    expect(team.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['team', 'owns']),
      }),
    );

    const area = routeIntent('who owns this area');
    expect(area.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['owns', 'area']),
      }),
    );

    const ask = routeIntent('who should I ask about auth');
    expect(ask.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['ask']),
      }),
    );
    expect(ask.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const help = routeIntent('who can help with payments');
    expect(help.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['help']),
      }),
    );

    const expert = routeIntent('find expert for billing');
    expect(expert.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'expert']),
      }),
    );
  });

  it('routes file authorship and history questions to file inspection instead of session history', () => {
    const touched = routeIntent('who last touched src/core/start.ts?');

    expect(touched.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['last', 'touched'],
      }),
    );
    expect(touched.matches.find((match) => match.tool === 'projscan_session')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['touched', 'last'],
      }),
    );

    const changed = routeIntent('who changed src/core/start.ts recently');
    expect(changed.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['changed', 'recently'],
      }),
    );
  });

  it('routes explicit file claim requests to advisory claims before path keywords', () => {
    const result = routeIntent('claim src/core/start.ts for me');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_claim',
        cli: 'projscan claim',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['claim'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();
  });

  it('routes claim requests with explicit agent names to advisory claims', () => {
    const result = routeIntent('claim src/core/start.ts as agent-alpha');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_claim',
        cli: 'projscan claim',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['claim'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_coordinate')).toBeUndefined();
  });

  it('routes active-claims questions to advisory claim listing', () => {
    const result = routeIntent('show active claims');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_claim',
        cli: 'projscan claim',
        confidence: 'high',
        score: 2.5,
        matchedKeywords: ['claims', 'active'],
      }),
    );
  });

  it('routes file importer questions to targeted semantic graph queries', () => {
    const result = routeIntent('who imports src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_semantic_graph',
        cli: 'projscan semantic-graph',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['imports'],
      }),
    );

    const packageImport = routeIntent('which files import package chalk');
    expect(packageImport.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['import']),
      }),
    );
    expect(
      packageImport.matches.find((match) => match.tool === 'projscan_upgrade'),
    ).toBeUndefined();

    const packageWho = routeIntent('who imports package chalk');
    expect(packageWho.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['imports']),
      }),
    );

    const packageUse = routeIntent('who uses lodash');
    expect(packageUse.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['uses']),
      }),
    );

    const dependencyWhy = routeIntent('why do we depend on lodash');
    expect(dependencyWhy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['depend']),
      }),
    );

    const installed = routeIntent('why is lodash installed');
    expect(installed.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['installed']),
      }),
    );

    const fileDependency = routeIntent('what depends on src/core/start.ts');
    expect(fileDependency.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['depends'],
      }),
    );
  });

  it('routes coverage gap questions to scariest-untested-files analysis', () => {
    const result = routeIntent('what are the scariest untested files');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Tests',
        tool: 'projscan_coverage',
        cli: 'projscan coverage',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['scariest', 'untested'],
      }),
    );

    const noTests = routeIntent('which files have no tests');
    expect(noTests.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coverage',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['files', 'no', 'tests']),
      }),
    );
    expect(
      noTests.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();
  });

  it('routes package bump questions to upgrade preview before generic impact', () => {
    const result = routeIntent('what breaks if I bump chalk to 6');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['bump'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['breaks'],
      }),
    );
  });

  it('routes package update questions to upgrade preview before generic impact', () => {
    const result = routeIntent('what breaks if I update react');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        matchedKeywords: ['update'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['breaks'],
      }),
    );
  });

  it('routes rollback and revert questions to impact analysis', () => {
    const revert = routeIntent('how do I revert this change safely');
    expect(revert.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        matchedKeywords: ['revert'],
      }),
    );

    const backOut = routeIntent('back out this change');
    expect(backOut.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['back', 'out'],
      }),
    );

    const undo = routeIntent('can I undo this change');
    expect(undo.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['undo'],
      }),
    );

    const rollback = routeIntent('what is the safest rollback plan');
    expect(rollback.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['rollback'],
      }),
    );
    expect(rollback.matches.find((match) => match.tool === 'projscan_merge_risk')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['safest'],
      }),
    );
  });

  it('routes schema and column rollback questions to impact analysis', () => {
    const schema = routeIntent('what breaks if I change the schema');
    expect(schema.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        matchedKeywords: ['breaks', 'schema'],
      }),
    );

    const column = routeIntent('can I drop this column');
    expect(column.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['drop', 'column'],
      }),
    );
    expect(column.matches.find((match) => match.tool === 'projscan_upgrade')).toBeUndefined();
  });

  it('routes package removal questions to upgrade preview impact', () => {
    const result = routeIntent('can I remove lodash');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['remove'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();
  });

  it('routes reversed package-removal wording to upgrade preview impact', () => {
    const result = routeIntent('is lodash safe to remove');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        matchedKeywords: ['remove'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_doctor')).toBeUndefined();
  });

  it('routes dependency vulnerability and CVE questions to audit', () => {
    const packageCve = routeIntent('does lodash have a CVE');
    expect(packageCve.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_audit',
        cli: 'projscan audit',
        confidence: 'high',
        matchedKeywords: ['cve'],
      }),
    );

    const repoCves = routeIntent('what CVEs affect this repo');
    expect(repoCves.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_audit',
        confidence: 'high',
        matchedKeywords: ['cves'],
      }),
    );
    expect(repoCves.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['affect'],
      }),
    );

    const auditSecurity = routeIntent('audit package security');
    expect(auditSecurity.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_audit',
        confidence: 'high',
        matchedKeywords: ['audit', 'security', 'package'],
      }),
    );

    const vulnerablePackages = routeIntent('find vulnerable packages');
    expect(vulnerablePackages.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_audit',
        confidence: 'high',
        matchedKeywords: ['vulnerable', 'packages'],
      }),
    );
    expect(
      vulnerablePackages.matches.find((match) => match.tool === 'projscan_dependencies'),
    ).toEqual(
      expect.objectContaining({
        matchedKeywords: ['packages'],
      }),
    );
  });

  it('routes monorepo workspace map questions to workspaces', () => {
    const workspaces = routeIntent('what workspaces are in this repo');
    expect(workspaces.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_workspaces',
        cli: 'projscan workspaces',
        confidence: 'high',
        matchedKeywords: ['workspaces'],
      }),
    );

    const packages = routeIntent('list monorepo packages');
    expect(packages.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['monorepo', 'packages', 'list'],
      }),
    );

    const map = routeIntent('monorepo package map');
    expect(map.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['monorepo', 'package', 'map'],
      }),
    );
    expect(map.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['package'],
      }),
    );
  });

  it('routes workspace ownership and placement questions to workspaces', () => {
    const owner = routeIntent('which workspace owns auth');
    expect(owner.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_workspaces',
        cli: 'projscan workspaces',
        confidence: 'high',
        matchedKeywords: ['workspace', 'owns'],
      }),
    );
    expect(owner.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const contains = routeIntent('what package contains auth');
    expect(contains.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['package', 'contains'],
      }),
    );

    const placement = routeIntent('where should I put this in the monorepo');
    expect(placement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['monorepo', 'put'],
      }),
    );
  });

  it('routes dependency inventory questions to dependency analysis before upgrade checks', () => {
    const result = routeIntent('what dependencies does this repo use');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['dependencies'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['dependencies'],
      }),
    );
  });

  it('routes dependency license and open-source compliance questions to dependency inventory', () => {
    const notices = routeIntent('third party notices');

    expect(notices.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        matchedKeywords: ['third', 'party', 'notices'],
      }),
    );

    const compliance = routeIntent('open source compliance check');
    expect(compliance.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['open', 'source', 'compliance']),
      }),
    );
  });

  it('routes PII and GDPR data-handling questions to dataflow hardening', () => {
    const pii = routeIntent('where is PII handled');

    expect(pii.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Security',
        tool: 'projscan_dataflow',
        cli: 'projscan dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['pii', 'handled']),
      }),
    );

    const leak = routeIntent('does this endpoint leak PII');
    expect(leak.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['leak', 'pii']),
      }),
    );

    const gdpr = routeIntent('GDPR compliance check');
    expect(gdpr.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['gdpr', 'compliance']),
      }),
    );
    expect(gdpr.matches.find((match) => match.tool === 'projscan_dependencies')).toBeUndefined();

    const tokens = routeIntent('where do we store access tokens');
    expect(tokens.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['store', 'tokens']),
      }),
    );
  });

  it('routes tiny safe task prompts to bug-hunt prioritization', () => {
    const fiveMinutes = routeIntent('what can I do in five minutes');

    expect(fiveMinutes.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        matchedKeywords: ['five', 'minutes'],
      }),
    );

    const easy = routeIntent('pick an easy task for me');
    expect(easy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['easy', 'task']),
      }),
    );

    const intern = routeIntent('what should an intern work on');
    expect(intern.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['intern'],
      }),
    );
  });

  it('routes tech-debt simplification away from incident down wording', () => {
    const techDebt = routeIntent('what tech debt should I pay down');

    expect(techDebt.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Hotspots',
        tool: 'projscan_hotspots',
        cli: 'projscan hotspots',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['tech', 'debt']),
      }),
    );
    expect(
      techDebt.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const simplify = routeIntent('what code should I simplify');
    expect(simplify.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['simplify'],
      }),
    );
  });

  it('routes local setup environment and connection failures to the right workflows', () => {
    const localServices = routeIntent('how do I start local services');
    expect(localServices.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['start', 'local', 'services']),
      }),
    );
    expect(
      localServices.matches.find((match) => match.tool === 'projscan_hotspots'),
    ).toBeUndefined();

    const dockerCommand = routeIntent('what command starts docker compose');
    expect(dockerCommand.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['command', 'docker', 'compose']),
      }),
    );

    const envMissing = routeIntent('environment variables missing');

    expect(envMissing.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['environment', 'variables', 'missing']),
      }),
    );

    const dbRefused = routeIntent('database connection refused locally');
    expect(dbRefused.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['connection', 'refused']),
      }),
    );
    expect(dbRefused.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();

    const portInUse = routeIntent('port 3000 already in use');
    expect(portInUse.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['port']),
      }),
    );

    const eaddrinuse = routeIntent('EADDRINUSE on startup');
    expect(eaddrinuse.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['eaddrinuse']),
      }),
    );

    const permissionDenied = routeIntent('permission denied when running dev server');
    expect(permissionDenied.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['permission', 'denied']),
      }),
    );

    const peerConflict = routeIntent('peer dependency conflict after npm install');
    expect(peerConflict.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['peer', 'install']),
      }),
    );
    expect(peerConflict.matches.find((match) => match.tool === 'projscan_dependencies')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['dependency'],
      }),
    );

    const enoent = routeIntent('ENOENT package.json missing');
    expect(enoent.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['enoent']),
      }),
    );
    expect(enoent.matches.find((match) => match.tool === 'projscan_upgrade')).toBeUndefined();
  });

  it('routes bundle-size and package-bloat questions to dependency inventory', () => {
    const bundle = routeIntent('why is the bundle so large');
    expect(bundle.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['bundle', 'large']),
      }),
    );
    expect(bundle.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['why'],
      }),
    );

    const reduce = routeIntent('reduce bundle size');
    expect(reduce.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['bundle', 'size']),
      }),
    );

    const bloat = routeIntent('find package bloat');
    expect(bloat.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['package', 'bloat']),
      }),
    );
    expect(bloat.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['package'],
      }),
    );
  });

  it('routes circular dependency and tight-coupling questions to coupling analysis', () => {
    const circular = routeIntent('show circular dependencies');
    expect(circular.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Architecture',
        tool: 'projscan_coupling',
        cli: 'projscan coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['circular', 'dependencies']),
      }),
    );
    expect(
      circular.matches.find((match) => match.tool === 'projscan_dependencies'),
    ).toBeUndefined();

    const cycles = routeIntent('find dependency cycles');
    expect(cycles.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['dependency', 'cycles']),
      }),
    );
    expect(cycles.matches.find((match) => match.tool === 'projscan_dependencies')).toBeUndefined();

    const tight = routeIntent('what modules are tightly coupled');
    expect(tight.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['modules', 'coupled']),
      }),
    );
  });

  it('returns the full grouped catalog when no intent is given', () => {
    const result = routeIntent(undefined);
    expect(result.intent).toBeNull();
    expect(result.matches.length).toBe(ROUTE_CATALOG.length);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        confidence: 'low',
        rank: 1,
        score: 0,
        matchedKeywords: [],
      }),
    );
    // grouped by category, every catalog entry present
    const tools = new Set(result.matches.map((m) => m.tool));
    expect(tools.has('projscan_understand')).toBe(true);
    expect(tools.has('projscan_collision')).toBe(true);
  });

  it('reports no match for an unrelated intent', () => {
    const result = routeIntent('brew a cup of tea');
    expect(result.matches).toEqual([]);
    expect(result.matched).toBe(false);
  });

  it('every catalog entry names a real tool and a runnable example', () => {
    for (const entry of ROUTE_CATALOG) {
      expect(entry.tool).toMatch(/^projscan_/);
      expect(entry.cli).toMatch(/^projscan /);
      expect(entry.example.length).toBeGreaterThan(0);
      expect(entry.keywords.length).toBeGreaterThan(0);
    }
  });
});
