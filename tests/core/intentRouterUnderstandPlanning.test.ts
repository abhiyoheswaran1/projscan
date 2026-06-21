import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent understand and planning routing', () => {
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
        matchedKeywords: ['need', 'change', 'files', 'auth'],
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
});
