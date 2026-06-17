import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { routeIntent, ROUTE_CATALOG } from '../../src/core/intentRouter.js';

describe('routeIntent', () => {
  it('keeps dependency and coupling keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterDependencySignals.js'");
    expect(routerSource).not.toContain('function dependenciesKeywordMatches');
    expect(routerSource).not.toContain('function couplingKeywordMatches');
    expect(routerSource).not.toContain('function auditKeywordMatches');
    expect(routerSource).not.toContain('function workspacesKeywordMatches');

    const dependencySignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterDependencySignals.ts'),
      'utf8',
    );
    expect(dependencySignalsSource).toContain('export function dependenciesKeywordMatches');
    expect(dependencySignalsSource).toContain('export function couplingKeywordMatches');
  });

  it('keeps review and evidence keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterReviewSignals.js'");
    expect(routerSource).not.toContain('function evidencePackKeywordMatches');
    expect(routerSource).not.toContain('function reviewKeywordMatches');

    const reviewSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterReviewSignals.ts'),
      'utf8',
    );
    expect(reviewSignalsSource).toContain('export function evidencePackKeywordMatches');
    expect(reviewSignalsSource).toContain('export function reviewKeywordMatches');
  });

  it('keeps PR diff keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterPrDiffSignals.js'");
    expect(routerSource).not.toContain('function prDiffKeywordMatches');

    const prDiffSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterPrDiffSignals.ts'),
      'utf8',
    );
    expect(prDiffSignalsSource).toContain('export function prDiffKeywordMatches');
  });

  it('keeps preflight route routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterPreflightSignals.js'");
    expect(routerSource).not.toContain('function preflightReadyContextMatches');
    expect(routerSource).not.toContain('function preflightRiskContextMatches');
    expect(routerSource).not.toContain('function preflightBranchRecoveryContextMatches');

    const preflightSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterPreflightSignals.ts'),
      'utf8',
    );
    expect(preflightSignalsSource).toContain('export function preflightReadyContextMatches');
    expect(preflightSignalsSource).toContain('export function preflightRiskContextMatches');
    expect(preflightSignalsSource).toContain(
      'export function preflightBranchRecoveryContextMatches',
    );
  });

  it('keeps planning route routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterPlanningSignals.js'");
    expect(routerSource).not.toContain('function featurePlacementContextMatches');
    expect(routerSource).not.toContain('function domainWorkflowPlanningContextMatches');
    expect(routerSource).not.toContain('function stateManagementPlanningContextMatches');
    expect(routerSource).not.toContain('function dataAccessPlanningContextMatches');
    expect(routerSource).not.toContain('function documentationPlanningContextMatches');
    expect(routerSource).not.toContain('function databaseChangePlanningContextMatches');
    expect(routerSource).not.toContain('function apiChangePlanningContextMatches');

    const planningSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterPlanningSignals.ts'),
      'utf8',
    );
    expect(planningSignalsSource).toContain('export function featurePlacementContextMatches');
    expect(planningSignalsSource).toContain(
      'export function domainWorkflowPlanningContextMatches',
    );
    expect(planningSignalsSource).toContain(
      'export function stateManagementPlanningContextMatches',
    );
    expect(planningSignalsSource).toContain('export function dataAccessPlanningContextMatches');
    expect(planningSignalsSource).toContain('export function documentationPlanningContextMatches');
    expect(planningSignalsSource).toContain('export function databaseChangePlanningContextMatches');
    expect(planningSignalsSource).toContain('export function apiChangePlanningContextMatches');
  });

  it('keeps dataflow and privacy keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSecuritySignals.js'");
    expect(routerSource).not.toContain('function dataflowKeywordMatches');
    expect(routerSource).not.toContain('function privacyCheckKeywordMatches');

    const securitySignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSecuritySignals.ts'),
      'utf8',
    );
    expect(securitySignalsSource).toContain('export function dataflowKeywordMatches');
    expect(securitySignalsSource).toContain('export function privacyCheckKeywordMatches');
  });

  it('keeps infra artifact search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchInfraSignals.js'");
    expect(routerSource).not.toContain('function searchInfraArtifactContextMatches');

    const infraSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchInfraSignals.ts'),
      'utf8',
    );
    expect(infraSignalsSource).toContain('export function searchInfraArtifactContextMatches');
  });

  it('keeps UI interaction search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchUiSignals.js'");
    expect(routerSource).not.toContain('function searchUiInteractionContextMatches');

    const uiSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchUiSignals.ts'),
      'utf8',
    );
    expect(uiSignalsSource).toContain('export function searchUiInteractionContextMatches');
  });

  it('keeps reliability search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchReliabilitySignals.js'");
    expect(routerSource).not.toContain('function searchReliabilityContextMatches');

    const reliabilitySignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchReliabilitySignals.ts'),
      'utf8',
    );
    expect(reliabilitySignalsSource).toContain(
      'export function searchReliabilityContextMatches',
    );
  });

  it('keeps style-system search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchStyleSignals.js'");
    expect(routerSource).not.toContain('function searchStyleSystemContextMatches');

    const styleSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchStyleSignals.ts'),
      'utf8',
    );
    expect(styleSignalsSource).toContain('export function searchStyleSystemContextMatches');
  });

  it('keeps integration search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchIntegrationSignals.js'");
    expect(routerSource).not.toContain('function searchIntegrationContextMatches');

    const integrationSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchIntegrationSignals.ts'),
      'utf8',
    );
    expect(integrationSignalsSource).toContain('export function searchIntegrationContextMatches');
  });

  it('keeps API contract search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchApiSignals.js'");
    expect(routerSource).not.toContain('function searchApiContractContextMatches');

    const apiSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchApiSignals.ts'),
      'utf8',
    );
    expect(apiSignalsSource).toContain('export function searchApiContractContextMatches');
  });

  it('keeps communication artifact search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchCommunicationSignals.js'");
    expect(routerSource).not.toContain('function searchCommunicationArtifactContextMatches');

    const communicationSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchCommunicationSignals.ts'),
      'utf8',
    );
    expect(communicationSignalsSource).toContain(
      'export function searchCommunicationArtifactContextMatches',
    );
  });

  it('keeps state management search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchStateSignals.js'");
    expect(routerSource).not.toContain('function searchStateManagementContextMatches');

    const stateSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchStateSignals.ts'),
      'utf8',
    );
    expect(stateSignalsSource).toContain('export function searchStateManagementContextMatches');
  });

  it('keeps domain workflow search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchDomainSignals.js'");
    expect(routerSource).not.toContain('function searchDomainWorkflowContextMatches');

    const domainSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchDomainSignals.ts'),
      'utf8',
    );
    expect(domainSignalsSource).toContain('export function searchDomainWorkflowContextMatches');
  });

  it('keeps frontend page search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchPageSignals.js'");
    expect(routerSource).not.toContain('function searchFrontendPageRouteContextMatches');

    const pageSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchPageSignals.ts'),
      'utf8',
    );
    expect(pageSignalsSource).toContain(
      'export function searchFrontendPageRouteContextMatches',
    );
  });

  it('keeps tooling config search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchToolingSignals.js'");
    expect(routerSource).not.toContain('function searchToolingConfigContextMatches');

    const toolingSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchToolingSignals.ts'),
      'utf8',
    );
    expect(toolingSignalsSource).toContain('export function searchToolingConfigContextMatches');
  });

  it('keeps navigation layout search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterSearchNavigationSignals.js'");
    expect(routerSource).not.toContain('function searchNavigationLayoutContextMatches');

    const navigationSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchNavigationSignals.ts'),
      'utf8',
    );
    expect(navigationSignalsSource).toContain(
      'export function searchNavigationLayoutContextMatches',
    );
  });

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
        tool: 'projscan_release_train',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['changed', 'since', 'release']),
      }),
    );
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
