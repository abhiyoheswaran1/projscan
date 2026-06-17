import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent search and impact routing', () => {
  it('routes "what breaks if I rename a function" to impact', () => {
    const result = routeIntent('what breaks if I rename a function');
    expect(result.matches[0].tool).toBe('projscan_impact');
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        confidence: 'high',
        rank: 1,
        score: 2,
        matchedKeywords: ['breaks', 'rename'],
      }),
    );
  });

  it('routes trust-boundary and privacy questions to privacy-check', () => {
    const readBoundary = routeIntent('what can projscan read?');

    expect(readBoundary.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Trust',
        tool: 'projscan_privacy_check',
        cli: 'projscan privacy-check',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['read']),
      }),
    );
    expect(readBoundary.matches.find((match) => match.tool === 'projscan_understand')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['read'],
      }),
    );

    const envValues = routeIntent('does projscan read .env values?');
    expect(envValues.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_privacy_check',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['read', 'env']),
      }),
    );

    const upload = routeIntent('will projscan upload my code?');
    expect(upload.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_privacy_check',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['upload', 'code']),
      }),
    );

    const telemetry = routeIntent('is telemetry enabled?');
    expect(telemetry.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_privacy_check',
        confidence: 'high',
        matchedKeywords: ['telemetry'],
      }),
    );

    expect(routeIntent('what files should I read first?').matches[0].tool).toBe(
      'projscan_understand',
    );
    expect(routeIntent('run a health check').matches[0].tool).toBe('projscan_doctor');
    expect(routeIntent('write a PR description').matches[0].tool).not.toBe(
      'projscan_privacy_check',
    );
  });

  it('routes symbol usage questions to impact instead of generic search', () => {
    const result = routeIntent('where is runAudit used');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['used'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_search')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['where'],
      }),
    );
  });

  it('routes file dependency questions to high-confidence impact', () => {
    const result = routeIntent('what depends on src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['depends'],
      }),
    );
  });

  it('routes file deletion questions to high-confidence impact without path-token onboarding noise', () => {
    const result = routeIntent('can I delete src/core/start.ts?');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['delete'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_start')).toBeUndefined();
    expect(result.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();
  });

  it('routes broad safe-delete cleanup questions to doctor without hijacking targeted deletion impact', () => {
    const safeDelete = routeIntent('what can I safely delete?');

    expect(safeDelete.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Health',
        tool: 'projscan_doctor',
        cli: 'projscan doctor',
        confidence: 'high',
        matchedKeywords: ['safely', 'delete'],
      }),
    );
    expect(safeDelete.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();

    const safeToDelete = routeIntent('what is safe to delete?');
    expect(safeToDelete.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        confidence: 'high',
        matchedKeywords: ['safe', 'delete'],
      }),
    );

    const safeRemove = routeIntent('what can I remove safely?');
    expect(safeRemove.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_doctor',
        confidence: 'high',
        matchedKeywords: ['safely', 'remove'],
      }),
    );
    expect(safeRemove.matches.find((match) => match.tool === 'projscan_upgrade')).toBeUndefined();

    expect(routeIntent('can I delete src/core/start.ts?').matches[0].tool).toBe('projscan_impact');
    expect(routeIntent('what breaks if I delete auth token loader?').matches[0].tool).toBe(
      'projscan_impact',
    );
  });

  it('routes test-location questions to search without path-token start or hotspot noise', () => {
    const result = routeIntent('where are the tests for src/core/start.ts?');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['where', 'tests'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_regression_plan')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['tests'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_start')).toBeUndefined();
    expect(result.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();

    const authTests = routeIntent('where are tests for auth');
    expect(authTests.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['where', 'tests'],
      }),
    );
    expect(authTests.matches.find((match) => match.tool === 'projscan_regression_plan')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['tests'],
      }),
    );

    const specs = routeIntent('locate specs for checkout');
    expect(specs.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: ['locate', 'specs'],
      }),
    );
  });

  it('routes proactive test-selection questions to repo verification planning', () => {
    const result = routeIntent('which tests should I run for src/core/start.ts?');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['run', 'tests']),
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_search')).toBeUndefined();

    const beforePush = routeIntent('what should I test before pushing');
    expect(beforePush.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['test']),
      }),
    );
    expect(
      beforePush.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    expect(routeIntent('tests are failing').matches[0].tool).toBe('projscan_regression_plan');
  });

  it('routes existing-test coverage lookup questions to search instead of regression planning', () => {
    const which = routeIntent('which tests cover auth');
    expect(which.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['tests', 'cover']),
      }),
    );
    expect(
      which.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const what = routeIntent('what tests cover checkout');
    expect(what.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['tests', 'cover']),
      }),
    );

    const find = routeIntent('find tests that cover billing');
    expect(find.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'tests', 'cover']),
      }),
    );
  });

  it('routes code-location questions to search before broad file inspection', () => {
    const handled = routeIntent('what code handles billing');

    expect(handled.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        matchedKeywords: ['code', 'handles'],
      }),
    );

    const contains = routeIntent('which file contains checkout logic');
    expect(contains.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: ['contains', 'logic'],
      }),
    );
    expect(contains.matches.find((match) => match.tool === 'projscan_file')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['file'],
      }),
    );

    const handler = routeIntent('find the Stripe webhook handler');
    expect(handler.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'handler']),
      }),
    );

    const apiHandler = routeIntent('what handles /api/login');
    expect(apiHandler.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['api', 'handles']),
      }),
    );

    const postHandler = routeIntent('find the handler for POST /api/users');
    expect(postHandler.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'handler', 'api']),
      }),
    );

    const settingsPage = routeIntent('where is /settings page rendered');
    expect(settingsPage.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'settings', 'page', 'rendered']),
      }),
    );

    const billingPage = routeIntent('which page renders /billing');
    expect(billingPage.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['page', 'renders', 'billing']),
      }),
    );

    const routeSegment = routeIntent('where is route segment for dashboard');
    expect(routeSegment.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'route', 'segment', 'dashboard']),
      }),
    );

    const notFoundPage = routeIntent('where is not-found page handled');
    expect(notFoundPage.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'not', 'found', 'page', 'handled']),
      }),
    );

    expect(routeIntent('why is /settings returning 404').matches[0].tool).toBe(
      'projscan_regression_plan',
    );

    const flags = routeIntent('which feature flags exist');
    expect(flags.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['feature', 'flags']),
      }),
    );

    const migrations = routeIntent('which migrations exist');
    expect(migrations.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['migrations', 'exist']),
      }),
    );
    expect(migrations.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();

    const migrationFiles = routeIntent('what migration files exist');
    expect(migrationFiles.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['migration', 'files', 'exist']),
      }),
    );
    expect(
      migrationFiles.matches.find((match) => match.tool === 'projscan_impact'),
    ).toBeUndefined();

    const generatedFiles = routeIntent('show me generated files');
    expect(generatedFiles.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['generated', 'files']),
      }),
    );

    const generatedCode = routeIntent('is this generated code');
    expect(generatedCode.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['generated', 'code']),
      }),
    );

    const eslintConfig = routeIntent('where is eslint config');
    expect(eslintConfig.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'config']),
      }),
    );

    const viteConfig = routeIntent('find vite config');
    expect(viteConfig.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'config']),
      }),
    );

    const aliases = routeIntent('which config file defines aliases');
    expect(aliases.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['config', 'file', 'defines', 'aliases']),
      }),
    );
    expect(aliases.matches.find((match) => match.tool === 'projscan_file')).toBeUndefined();

    const tsconfigAliases = routeIntent('where is tsconfig path aliases configured');
    expect(tsconfigAliases.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining([
          'where',
          'tsconfig',
          'path',
          'aliases',
          'configured',
        ]),
      }),
    );

    const vitestConfig = routeIntent('where is Vitest config');
    expect(vitestConfig.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'vitest', 'config']),
      }),
    );

    const babelConfig = routeIntent('find Babel config');
    expect(babelConfig.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'babel', 'config']),
      }),
    );

    const packageManager = routeIntent('where is package manager configured');
    expect(packageManager.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'package', 'manager', 'configured']),
      }),
    );

    const pnpmWorkspace = routeIntent('where is pnpm workspace file');
    expect(pnpmWorkspace.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'pnpm', 'workspace', 'file']),
      }),
    );

    expect(routeIntent('why is vitest failing').matches[0].tool).toBe('projscan_regression_plan');

    expect(routeIntent('what config does this repo need').matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'medium',
        matchedKeywords: ['config'],
      }),
    );

    const envUsage = routeIntent('where is NEXT_PUBLIC_API_URL used');
    expect(envUsage.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'used']),
      }),
    );
    expect(envUsage.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();

    const processEnv = routeIntent('find process.env.NODE_ENV');
    expect(processEnv.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'process', 'env']),
      }),
    );
    expect(processEnv.matches.find((match) => match.tool === 'projscan_dataflow')).toBeUndefined();

    const controlEnv = routeIntent('which env var controls auth');
    expect(controlEnv.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['env', 'var', 'controls']),
      }),
    );

    expect(routeIntent('what env vars does this repo need').matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_understand',
        confidence: 'high',
        matchedKeywords: ['env', 'vars'],
      }),
    );

    const thrownString = routeIntent('where is "Invalid token" thrown');
    expect(thrownString.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'thrown']),
      }),
    );
    expect(
      thrownString.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const errorMessage = routeIntent('find error message "Payment failed"');
    expect(errorMessage.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'error', 'message']),
      }),
    );
    expect(
      errorMessage.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const loggedString = routeIntent('where do we log "could not connect"');
    expect(loggedString.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'log']),
      }),
    );
    expect(
      loggedString.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const throwsString = routeIntent('what throws "Missing API key"');
    expect(throwsString.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['throws']),
      }),
    );
    expect(
      throwsString.matches.find((match) => match.tool === 'projscan_understand'),
    ).toBeUndefined();

    const backgroundJobs = routeIntent('what background jobs exist');
    expect(backgroundJobs.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['background', 'jobs', 'exist']),
      }),
    );

    const cronJobs = routeIntent('which cron jobs exist');
    expect(cronJobs.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['cron', 'jobs', 'exist']),
      }),
    );

    const queueProcessor = routeIntent('find the email queue processor');
    expect(queueProcessor.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'queue', 'processor']),
      }),
    );
    expect(
      queueProcessor.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const scheduledTasks = routeIntent('where are scheduled tasks defined');
    expect(scheduledTasks.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'scheduled', 'tasks', 'defined']),
      }),
    );
    expect(
      scheduledTasks.matches.find((match) => match.tool === 'projscan_semantic_graph'),
    ).toBeUndefined();

    expect(routeIntent('what tasks should I do next').matches[0].tool).toBe('projscan_workplan');

    const metrics = routeIntent('where are metrics emitted');
    expect(metrics.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'metrics', 'emitted']),
      }),
    );

    const prometheus = routeIntent('find prometheus metrics');
    expect(prometheus.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'prometheus', 'metrics']),
      }),
    );

    const sentry = routeIntent('where do we initialize Sentry');
    expect(sentry.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'initialize', 'sentry']),
      }),
    );

    const checkoutLogs = routeIntent('what logs should I check for checkout');
    expect(checkoutLogs.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['logs', 'check']),
      }),
    );
    expect(
      checkoutLogs.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const dashboard = routeIntent('find the dashboard for payments');
    expect(dashboard.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'dashboard']),
      }),
    );

    const seedData = routeIntent('where is seed data defined');
    expect(seedData.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'seed', 'data', 'defined']),
      }),
    );
    expect(seedData.matches.find((match) => match.tool === 'projscan_dataflow')).toBeUndefined();
    expect(
      seedData.matches.find((match) => match.tool === 'projscan_semantic_graph'),
    ).toBeUndefined();

    const fixtures = routeIntent('find fixtures for checkout');
    expect(fixtures.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'fixtures']),
      }),
    );

    const mocks = routeIntent('which mocks are used for payments');
    expect(mocks.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['mocks', 'used']),
      }),
    );
    expect(mocks.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();

    const stories = routeIntent('where are Storybook stories for Button');
    expect(stories.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'storybook', 'stories']),
      }),
    );
    expect(stories.matches.find((match) => match.tool === 'projscan_understand')).toBeUndefined();

    const story = routeIntent('which story renders checkout');
    expect(story.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['story', 'renders']),
      }),
    );

    const permissions = routeIntent('where are permissions checked for checkout');
    expect(permissions.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'permissions', 'checked']),
      }),
    );

    const role = routeIntent('which role can access admin');
    expect(role.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['role', 'access']),
      }),
    );

    const guard = routeIntent('what guards the admin page');
    expect(guard.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['guards']),
      }),
    );

    const rbac = routeIntent('where is RBAC defined');
    expect(rbac.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'rbac', 'defined']),
      }),
    );
    expect(rbac.matches.find((match) => match.tool === 'projscan_semantic_graph')).toBeUndefined();

    const loginRoutes = routeIntent('what routes require login');
    expect(loginRoutes.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['routes', 'require', 'login']),
      }),
    );

    const rateLimiting = routeIntent('where is rate limiting configured');
    expect(rateLimiting.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'rate', 'limiting', 'configured']),
      }),
    );

    const checkoutLimits = routeIntent('what rate limits protect checkout');
    expect(checkoutLimits.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['rate', 'limits']),
      }),
    );

    const cacheInvalidation = routeIntent('where is cache invalidated for products');
    expect(cacheInvalidation.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'cache', 'invalidated']),
      }),
    );
    expect(
      cacheInvalidation.matches.find((match) => match.tool === 'projscan_impact'),
    ).toBeUndefined();

    const retryLookup = routeIntent('which code retries failed requests');
    expect(retryLookup.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['code', 'retries', 'failed', 'requests']),
      }),
    );
    expect(
      retryLookup.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const timeoutLookup = routeIntent('what sets request timeout');
    expect(timeoutLookup.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['request', 'timeout']),
      }),
    );
    expect(
      timeoutLookup.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const idempotency = routeIntent('find idempotency key handling');
    expect(idempotency.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'idempotency', 'key']),
      }),
    );

    const webhookSignature = routeIntent('where is webhook signature verified');
    expect(webhookSignature.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'webhook', 'signature', 'verified']),
      }),
    );

    const inputValidation = routeIntent('where is input validation for signup');
    expect(inputValidation.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'input', 'validation']),
      }),
    );

    const schemaValidation = routeIntent('which schema validates checkout');
    expect(schemaValidation.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['schema', 'validates']),
      }),
    );
    expect(
      schemaValidation.matches.find((match) => match.tool === 'projscan_impact'),
    ).toBeUndefined();

    const requestParams = routeIntent('where are request params parsed');
    expect(requestParams.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'request', 'params', 'parsed']),
      }),
    );
    expect(
      requestParams.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const apiSerialization = routeIntent('what serializes API response');
    expect(apiSerialization.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['api', 'response', 'serializes']),
      }),
    );
    expect(
      apiSerialization.matches.find((match) => match.tool === 'projscan_understand'),
    ).toBeUndefined();

    const transaction = routeIntent('where is database transaction started');
    expect(transaction.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'database', 'transaction']),
      }),
    );
    expect(
      transaction.matches.find((match) => match.tool === 'projscan_understand'),
    ).toBeUndefined();

    const rowLock = routeIntent('where do we lock the order row');
    expect(rowLock.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'lock', 'row']),
      }),
    );
    expect(rowLock.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const uniqueness = routeIntent('what validates email uniqueness');
    expect(uniqueness.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['validates', 'email', 'uniqueness']),
      }),
    );
    expect(uniqueness.matches.find((match) => match.tool === 'projscan_dataflow')).toBeUndefined();

    const pagination = routeIntent('what builds pagination cursors');
    expect(pagination.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['pagination', 'cursors']),
      }),
    );

    const formSubmit = routeIntent('where is the signup form submitted');
    expect(formSubmit.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'form', 'submitted']),
      }),
    );

    const loadingState = routeIntent('where is loading state for dashboard');
    expect(loadingState.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'loading', 'state']),
      }),
    );

    const emptyState = routeIntent('what renders empty state for search results');
    expect(emptyState.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['renders', 'empty', 'state']),
      }),
    );

    const errorBoundary = routeIntent('where is error boundary for settings');
    expect(errorBoundary.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'error', 'boundary']),
      }),
    );
    expect(
      errorBoundary.matches.find((match) => match.tool === 'projscan_privacy_check'),
    ).toBeUndefined();
    expect(
      errorBoundary.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const toast = routeIntent('where is toast shown after checkout');
    expect(toast.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'toast']),
      }),
    );

    const shortcut = routeIntent('where is keyboard shortcut for save');
    expect(shortcut.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'keyboard', 'shortcut']),
      }),
    );

    const commandPalette = routeIntent('find command palette actions');
    expect(commandPalette.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'command', 'palette', 'actions']),
      }),
    );
    expect(
      commandPalette.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const pageComponent = routeIntent('what component renders the billing page');
    expect(pageComponent.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['component', 'renders', 'page']),
      }),
    );

    const translations = routeIntent('where are i18n translations for checkout');
    expect(translations.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'i18n', 'translations']),
      }),
    );

    const aria = routeIntent('where is aria label for submit button');
    expect(aria.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'aria', 'label', 'button']),
      }),
    );
    expect(aria.matches.find((match) => match.tool === 'projscan_understand')).toBeUndefined();

    const focusTrap = routeIntent('where is focus trap implemented');
    expect(focusTrap.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'focus', 'trap']),
      }),
    );
    expect(focusTrap.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();

    const designTokens = routeIntent('where are design tokens defined');
    expect(designTokens.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'design', 'tokens', 'defined']),
      }),
    );
    expect(
      designTokens.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const tailwindTheme = routeIntent('where is Tailwind theme configured');
    expect(tailwindTheme.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'tailwind', 'theme', 'configured']),
      }),
    );

    const globalCss = routeIntent('where is global CSS imported');
    expect(globalCss.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'global', 'css', 'imported']),
      }),
    );

    const cssModule = routeIntent('which CSS module styles Button');
    expect(cssModule.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['css', 'module', 'styles', 'button']),
      }),
    );

    const darkMode = routeIntent('where is dark mode configured');
    expect(darkMode.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'dark', 'mode', 'configured']),
      }),
    );

    const breakpoints = routeIntent('what breakpoints are defined');
    expect(breakpoints.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['breakpoints', 'defined']),
      }),
    );

    expect(routeIntent('add dark mode').matches[0].tool).toBe('projscan_understand');
    expect(routeIntent('why is dark mode failing').matches[0].tool).toBe(
      'projscan_regression_plan',
    );

    const stripeCall = routeIntent('where do we call Stripe');
    expect(stripeCall.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'call', 'stripe']),
      }),
    );

    const sendGridEmail = routeIntent('which code sends email through SendGrid');
    expect(sendGridEmail.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['code', 'sends', 'email', 'sendgrid']),
      }),
    );
    expect(
      sendGridEmail.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const s3Upload = routeIntent('where is S3 upload implemented');
    expect(s3Upload.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 's3', 'upload', 'implemented']),
      }),
    );
    expect(
      s3Upload.matches.find((match) => match.tool === 'projscan_privacy_check'),
    ).toBeUndefined();

    const githubClient = routeIntent('find GitHub API client');
    expect(githubClient.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'github', 'api', 'client']),
      }),
    );

    const graphqlQuery = routeIntent('where is GraphQL query for invoices');
    expect(graphqlQuery.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'graphql', 'query']),
      }),
    );
    expect(
      graphqlQuery.matches.find((match) => match.tool === 'projscan_understand'),
    ).toBeUndefined();

    const websocketConnection = routeIntent('where is websocket connection opened');
    expect(websocketConnection.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'websocket', 'connection', 'opened']),
      }),
    );
    expect(
      websocketConnection.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const openApiSpec = routeIntent('where is OpenAPI spec defined');
    expect(openApiSpec.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'openapi', 'spec', 'defined']),
      }),
    );

    const swaggerDocs = routeIntent('where is Swagger docs configured');
    expect(swaggerDocs.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'swagger', 'docs', 'configured']),
      }),
    );

    const trpcRouter = routeIntent('where is tRPC router for billing');
    expect(trpcRouter.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'trpc', 'router']),
      }),
    );
    expect(
      trpcRouter.matches.find((match) => match.tool === 'projscan_understand'),
    ).toBeUndefined();

    const graphqlResolver = routeIntent('which GraphQL resolver handles invoices');
    expect(graphqlResolver.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['graphql', 'resolver', 'handles']),
      }),
    );

    const protobufService = routeIntent('which protobuf defines user service');
    expect(protobufService.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['protobuf', 'defines', 'service']),
      }),
    );

    const grpcClient = routeIntent('where is gRPC client for payments');
    expect(grpcClient.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'grpc', 'client']),
      }),
    );

    expect(routeIntent('what are the public contracts?').matches[0].tool).toBe(
      'projscan_understand',
    );

    const dockerfile = routeIntent('where is the Dockerfile');
    expect(dockerfile.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'dockerfile']),
      }),
    );

    const compose = routeIntent('where is docker compose for local dev');
    expect(compose.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'docker', 'compose']),
      }),
    );

    const kubernetes = routeIntent('where are Kubernetes manifests');
    expect(kubernetes.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'kubernetes', 'manifests']),
      }),
    );

    const helm = routeIntent('find Helm chart for payments');
    expect(helm.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'helm', 'chart']),
      }),
    );

    const terraform = routeIntent('where is Terraform module for S3');
    expect(terraform.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'terraform', 'module', 's3']),
      }),
    );

    const deployWorkflow = routeIntent('which GitHub workflow deploys staging');
    expect(deployWorkflow.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['github', 'workflow', 'deploys', 'staging']),
      }),
    );
    expect(
      deployWorkflow.matches.find((match) => match.tool === 'projscan_release_train'),
    ).toBeUndefined();
    expect(routeIntent('can I deploy this?').matches[0].tool).toBe('projscan_release_train');

    const vercelConfig = routeIntent('where is Vercel config');
    expect(vercelConfig.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'vercel', 'config']),
      }),
    );

    const passwordReset = routeIntent('where is password reset handled');
    expect(passwordReset.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'password', 'reset', 'handled']),
      }),
    );
    expect(
      passwordReset.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const inviteFlow = routeIntent('where is team invite flow');
    expect(inviteFlow.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'team', 'invite', 'flow']),
      }),
    );

    const onboarding = routeIntent('where is onboarding flow implemented');
    expect(onboarding.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'onboarding', 'flow', 'implemented']),
      }),
    );
    expect(
      onboarding.matches.find((match) => match.tool === 'projscan_understand'),
    ).toBeUndefined();

    const csvExport = routeIntent('find CSV export for users');
    expect(csvExport.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'csv', 'export', 'users']),
      }),
    );

    const auditLog = routeIntent('what creates audit log entries');
    expect(auditLog.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['creates', 'audit', 'log', 'entries']),
      }),
    );
    expect(
      auditLog.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const refund = routeIntent('where is refund handling for payments');
    expect(refund.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'refund', 'handling', 'payments']),
      }),
    );

    const renewal = routeIntent('where is subscription renewal handled');
    expect(renewal.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'subscription', 'renewal', 'handled']),
      }),
    );

    expect(routeIntent('implement password reset').matches[0].tool).toBe('projscan_understand');

    const welcomeEmail = routeIntent('where is welcome email template');
    expect(welcomeEmail.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'welcome', 'email', 'template']),
      }),
    );
    expect(
      welcomeEmail.matches.find((match) => match.tool === 'projscan_dataflow'),
    ).toBeUndefined();

    const resetEmailCopy = routeIntent('find password reset email copy');
    expect(resetEmailCopy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'password', 'reset', 'email', 'copy']),
      }),
    );

    const pushCopy = routeIntent('where is push notification copy for invites');
    expect(pushCopy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining([
          'where',
          'push',
          'notification',
          'copy',
          'invites',
        ]),
      }),
    );
    expect(
      pushCopy.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const smsTemplate = routeIntent('where is SMS verification template');
    expect(smsTemplate.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'sms', 'verification', 'template']),
      }),
    );

    const receiptEmail = routeIntent('which template sends receipt email');
    expect(receiptEmail.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['template', 'sends', 'receipt', 'email']),
      }),
    );

    const invoicePdf = routeIntent('where is invoice PDF generated');
    expect(invoicePdf.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'invoice', 'pdf', 'generated']),
      }),
    );

    const authState = routeIntent('where is auth state stored');
    expect(authState.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'state', 'stored']),
      }),
    );
    expect(authState.matches.find((match) => match.tool === 'projscan_dataflow')).toBeUndefined();

    const reduxSlice = routeIntent('find Redux slice for cart');
    expect(reduxSlice.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'redux', 'slice']),
      }),
    );

    const zustandStore = routeIntent('where is Zustand store for user settings');
    expect(zustandStore.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'zustand', 'store']),
      }),
    );

    const themeProvider = routeIntent('which context provider supplies theme');
    expect(themeProvider.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['context', 'provider', 'supplies']),
      }),
    );

    const invoicesHook = routeIntent('which hook fetches invoices');
    expect(invoicesHook.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['hook', 'fetches', 'invoices']),
      }),
    );

    const checkoutMutation = routeIntent('where is React Query mutation for checkout');
    expect(checkoutMutation.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'react', 'query', 'mutation']),
      }),
    );

    expect(routeIntent('implement Redux store').matches[0].tool).toBe('projscan_understand');

    const prismaModel = routeIntent('where is Prisma model for User');
    expect(prismaModel.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'prisma', 'model']),
      }),
    );
    expect(prismaModel.matches.find((match) => match.tool === 'projscan_dataflow')).toBeUndefined();

    const drizzleSchema = routeIntent('find Drizzle schema for invoices');
    expect(drizzleSchema.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'drizzle', 'schema', 'invoices']),
      }),
    );

    const sqlQuery = routeIntent('where is SQL query for invoices');
    expect(sqlQuery.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'sql', 'query', 'invoices']),
      }),
    );
    expect(sqlQuery.matches.find((match) => match.tool === 'projscan_dataflow')).toBeUndefined();

    const repository = routeIntent('which repository saves orders');
    expect(repository.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['repository', 'saves', 'orders']),
      }),
    );

    const dao = routeIntent('find DAO for payments');
    expect(dao.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'dao', 'payments']),
      }),
    );

    expect(routeIntent('implement Prisma model').matches[0].tool).toBe('projscan_understand');
    expect(routeIntent('is user input reaching SQL sinks').matches[0].tool).toBe(
      'projscan_dataflow',
    );

    const sidebarNav = routeIntent('where is sidebar nav item for billing');
    expect(sidebarNav.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'sidebar', 'nav', 'item', 'billing']),
      }),
    );

    const breadcrumb = routeIntent('which breadcrumb renders settings');
    expect(breadcrumb.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['breadcrumb', 'renders', 'settings']),
      }),
    );

    const pageTitle = routeIntent('where is page title set for checkout');
    expect(pageTitle.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'page', 'title', 'set', 'checkout']),
      }),
    );

    const nextLayout = routeIntent('where is Next.js layout for dashboard');
    expect(nextLayout.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['where', 'next', 'js', 'layout', 'dashboard']),
      }),
    );

    expect(routeIntent('add sidebar nav item').matches[0].tool).toBe('projscan_understand');
    expect(routeIntent('is customer email leaking to logs').matches[0].tool).toBe(
      'projscan_dataflow',
    );
  });
});
