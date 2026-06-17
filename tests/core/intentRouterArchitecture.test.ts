import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('routeIntent architecture', () => {
  const keywordMatchesSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordMatches.ts'), 'utf8');
  const earlyGuardsSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordEarlyGuards.ts'), 'utf8');
  const searchGuardsSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordSearchGuards.ts'), 'utf8');
  const toolGuardsSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordToolGuards.ts'), 'utf8');
  const scoringSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterScoring.ts'), 'utf8');

  it('keeps the route catalog isolated from router scoring logic', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    const catalogSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterCatalog.ts'),
      'utf8',
    );

    expect(routerSource).toContain("from './intentRouterCatalog.js'");
    expect(routerSource).not.toContain('export const ROUTE_CATALOG');
    expect(catalogSource).toContain('export const ROUTE_CATALOG');
  });

  it('keeps dependency and coupling keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(toolGuardsSource()).toContain("from './intentRouterDependencySignals.js'");
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
    expect(earlyGuardsSource()).toContain("from './intentRouterReviewSignals.js'");
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
    expect(toolGuardsSource()).toContain("from './intentRouterPrDiffSignals.js'");
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
    expect(toolGuardsSource()).toContain("from './intentRouterPreflightSignals.js'");
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
    expect(earlyGuardsSource()).toContain("from './intentRouterPlanningSignals.js'");
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

  it('keeps repo setup and orientation routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(earlyGuardsSource()).toContain("from './intentRouterRepoSignals.js'");
    expect(routerSource).not.toContain('function repoRunContextMatches');
    expect(routerSource).not.toContain('function localServiceSetupCommandContextMatches');
    expect(routerSource).not.toContain('function databaseSetupCommandContextMatches');
    expect(routerSource).not.toContain('function npmScriptsContextMatches');
    expect(routerSource).not.toContain('function packageScriptDiscoveryContextMatches');
    expect(routerSource).not.toContain('function repoSetupContextMatches');
    expect(routerSource).not.toContain('function repoConfigContextMatches');
    expect(routerSource).not.toContain('function repoOrientationContextMatches');

    const repoSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterRepoSignals.ts'),
      'utf8',
    );
    expect(repoSignalsSource).toContain('export function repoRunContextMatches');
    expect(repoSignalsSource).toContain('export function localServiceSetupCommandContextMatches');
    expect(repoSignalsSource).toContain('export function databaseSetupCommandContextMatches');
    expect(repoSignalsSource).toContain('export function npmScriptsContextMatches');
    expect(repoSignalsSource).toContain('export function packageScriptDiscoveryContextMatches');
    expect(repoSignalsSource).toContain('export function repoSetupContextMatches');
    expect(repoSignalsSource).toContain('export function repoConfigContextMatches');
    expect(repoSignalsSource).toContain('export function repoOrientationContextMatches');
  });

  it('keeps test-data search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(searchGuardsSource()).toContain("from './intentRouterSearchTestSignals.js'");
    expect(routerSource).not.toContain('function searchTestDataContextMatches');

    const testSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchTestSignals.ts'),
      'utf8',
    );
    expect(testSignalsSource).toContain('export function searchTestDataContextMatches');
  });

  it('keeps data lookup search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(searchGuardsSource()).toContain("from './intentRouterSearchDataSignals.js'");
    expect(routerSource).not.toContain('function searchDataContractContextMatches');
    expect(routerSource).not.toContain('function searchDataAccessContextMatches');

    const dataSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchDataSignals.ts'),
      'utf8',
    );
    expect(dataSignalsSource).toContain('export function searchDataContractContextMatches');
    expect(dataSignalsSource).toContain('export function searchDataAccessContextMatches');
  });

  it('keeps background-work search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(searchGuardsSource()).toContain("from './intentRouterSearchBackgroundSignals.js'");
    expect(routerSource).not.toContain('function searchBackgroundWorkContextMatches');

    const backgroundSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchBackgroundSignals.ts'),
      'utf8',
    );
    expect(backgroundSignalsSource).toContain('export function searchBackgroundWorkContextMatches');
  });

  it('keeps ownership search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(searchGuardsSource()).toContain("from './intentRouterSearchOwnershipSignals.js'");
    expect(routerSource).not.toContain('function searchOwnershipContextMatches');

    const ownershipSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchOwnershipSignals.ts'),
      'utf8',
    );
    expect(ownershipSignalsSource).toContain('export function searchOwnershipContextMatches');
  });

  it('keeps regression and failure routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(toolGuardsSource()).toContain("from './intentRouterRegressionSignals.js'");
    expect(routerSource).not.toContain('function regressionFailureContextMatches');
    expect(routerSource).not.toContain('function regressionLocalSetupContextMatches');
    expect(routerSource).not.toContain('function regressionCiPlatformContextMatches');
    expect(routerSource).not.toContain('function regressionPerformanceContextMatches');
    expect(routerSource).not.toContain('function regressionBenchmarkContextMatches');
    expect(routerSource).not.toContain('function regressionFlakeContextMatches');
    expect(routerSource).not.toContain('function proofCommandContextMatches');
    expect(routerSource).not.toContain('function styleSystemFailureContextMatches');
    expect(routerSource).not.toContain('function toolingFailureContextMatches');

    const regressionSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterRegressionSignals.ts'),
      'utf8',
    );
    expect(regressionSignalsSource).toContain('export function regressionFailureContextMatches');
    expect(regressionSignalsSource).toContain('export function regressionFlakeContextMatches');
  });

  it('keeps verification and coverage routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(toolGuardsSource()).toContain("from './intentRouterVerificationSignals.js'");
    expect(routerSource).not.toContain('function verificationPlanningContextMatches');
    expect(routerSource).not.toContain('function searchTestLocationContextMatches');
    expect(routerSource).not.toContain('function testCoverageLookupContextMatches');
    expect(routerSource).not.toContain('function coverageKeywordMatches');
    expect(routerSource).not.toContain('function coverageGapContextMatches');
    expect(routerSource).not.toContain('function missingTestCoverageContextMatches');
    expect(routerSource).not.toContain('function searchCodeLocationContextMatches');
    expect(routerSource).not.toContain('function testRunContextMatches');

    const verificationSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterVerificationSignals.ts'),
      'utf8',
    );
    expect(verificationSignalsSource).toContain(
      'export function verificationPlanningContextMatches',
    );
    expect(verificationSignalsSource).toContain('export function coverageKeywordMatches');
  });

  it('keeps general lookup search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(searchGuardsSource()).toContain("from './intentRouterSearchLookupSignals.js'");
    expect(routerSource).not.toContain('function searchRouteHandlerContextMatches');
    expect(routerSource).not.toContain('function searchFeatureFlagContextMatches');
    expect(routerSource).not.toContain('function searchEnvLookupContextMatches');
    expect(routerSource).not.toContain('function searchQuotedDebugTextContextMatches');
    expect(routerSource).not.toContain('function searchObservabilityContextMatches');
    expect(routerSource).not.toContain('function searchAuthorizationContextMatches');
    expect(routerSource).not.toContain('function searchConfigLookupContextMatches');
    expect(routerSource).not.toContain('function searchMigrationLookupContextMatches');
    expect(routerSource).not.toContain('function searchGeneratedContextMatches');
    expect(routerSource).not.toContain('function searchDocumentationContextMatches');

    const lookupSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchLookupSignals.ts'),
      'utf8',
    );
    expect(lookupSignalsSource).toContain('export function searchRouteHandlerContextMatches');
    expect(lookupSignalsSource).toContain('export function searchDocumentationContextMatches');
  });

  it('keeps risk and impact routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(toolGuardsSource()).toContain("from './intentRouterRiskSignals.js'");
    expect(routerSource).not.toContain('function fileHistoryContextMatches');
    expect(routerSource).not.toContain('function fileTestContextMatches');
    expect(routerSource).not.toContain('function impactDeleteContextMatches');
    expect(routerSource).not.toContain('function impactDatabaseContextMatches');
    expect(routerSource).not.toContain('function impactApiKeywordMatches');
    expect(routerSource).not.toContain('function impactApiContextMatches');
    expect(routerSource).not.toContain('function impactRollbackContextMatches');
    expect(routerSource).not.toContain('function doctorCleanupDeleteContextMatches');
    expect(routerSource).not.toContain('function doctorCleanupDiscoveryContextMatches');
    expect(routerSource).not.toContain('function hotspotFileRiskContextMatches');
    expect(routerSource).not.toContain('function hotspotWhereContextMatches');
    expect(routerSource).not.toContain('function hotspotPerformanceContextMatches');

    const riskSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterRiskSignals.ts'),
      'utf8',
    );
    expect(riskSignalsSource).toContain('export function impactDeleteContextMatches');
    expect(riskSignalsSource).toContain('export function hotspotWhereContextMatches');
  });

  it('keeps release and no-release routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterScoring.js'");
    expect(scoringSource()).toContain("from './intentRouterReleaseSignals.js'");
    expect(routerSource).not.toContain('function hasProhibitedReleaseWorkflowAction');
    expect(routerSource).not.toContain('function hasProhibitedVersionBumpAction');
    expect(routerSource).not.toContain('function isReleaseWorkflowActionKeyword');
    expect(routerSource).not.toContain('function isVersionBumpActionKeyword');
    expect(routerSource).not.toContain('function prohibitedWorkflowKeywordMatches');
    expect(routerSource).not.toContain('function releaseReadinessContextMatches');
    expect(routerSource).not.toContain('function releaseTrainKeywordMatches');
    expect(routerSource).not.toContain('function releaseCommunicationContextMatches');

    const releaseSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterReleaseSignals.ts'),
      'utf8',
    );
    expect(releaseSignalsSource).toContain('export function hasProhibitedReleaseWorkflowAction');
    expect(releaseSignalsSource).toContain('export function prohibitedWorkflowKeywordMatches');
    expect(releaseSignalsSource).toContain('export function releaseTrainKeywordMatches');
  });

  it('keeps coordination and session routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(toolGuardsSource()).toContain("from './intentRouterCoordinationSignals.js'");
    expect(routerSource).not.toContain('function claimContextMatches');
    expect(routerSource).not.toContain('function claimKeywordMatches');
    expect(routerSource).not.toContain('function coordinateAgentContextMatches');
    expect(routerSource).not.toContain('function coordinateWorkingContextMatches');
    expect(routerSource).not.toContain('function coordinateActiveContextMatches');
    expect(routerSource).not.toContain('function coordinateConflictContextMatches');
    expect(routerSource).not.toContain('function collisionConflictContextMatches');
    expect(routerSource).not.toContain('function collisionChangeContextMatches');
    expect(routerSource).not.toContain('function mergeRiskKeywordMatches');
    expect(routerSource).not.toContain('function sessionLeaveOffContextMatches');
    expect(routerSource).not.toContain('function sessionAwayContextMatches');
    expect(routerSource).not.toContain('function sessionAgentContextMatches');

    const coordinationSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterCoordinationSignals.ts'),
      'utf8',
    );
    expect(coordinationSignalsSource).toContain('export function claimContextMatches');
    expect(coordinationSignalsSource).toContain('export function coordinateAgentContextMatches');
    expect(coordinationSignalsSource).toContain('export function sessionAgentContextMatches');
  });

  it('keeps workplan and bug-hunt opportunity routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(toolGuardsSource()).toContain("from './intentRouterWorkSignals.js'");
    expect(routerSource).not.toContain('function workplanDoContextMatches');
    expect(routerSource).not.toContain('function workplanKeywordMatches');
    expect(routerSource).not.toContain('function productPlanningContextMatches');
    expect(routerSource).not.toContain('function bugHuntSpeedContextMatches');
    expect(routerSource).not.toContain('function bugHuntOpportunityContextMatches');
    expect(routerSource).not.toContain('function protectedImproveNextContextMatches');

    const workSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterWorkSignals.ts'),
      'utf8',
    );
    expect(workSignalsSource).toContain('export function workplanKeywordMatches');
    expect(workSignalsSource).toContain('export function bugHuntSpeedContextMatches');
    expect(workSignalsSource).toContain('export function protectedImproveNextContextMatches');
  });

  it('keeps intent target detection isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterScoring.js'");
    expect(scoringSource()).toContain("from './intentRouterTargetSignals.js'");
    expect(routerSource).not.toContain('function hasFilePathTarget');
    expect(routerSource).not.toContain('function hasEnvVarTarget');
    expect(routerSource).not.toContain('function hasQuotedTextTarget');
    expect(routerSource).not.toContain('function hasPackageRemovalTarget');
    expect(routerSource).not.toContain('function hasPackageChangeTarget');

    const targetSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterTargetSignals.ts'),
      'utf8',
    );
    expect(targetSignalsSource).toContain('export function hasFilePathTarget');
    expect(targetSignalsSource).toContain('export function hasPackageRemovalTarget');
    expect(targetSignalsSource).toContain('export function hasPackageChangeTarget');
  });

  it('keeps understand keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(earlyGuardsSource()).toContain("from './intentRouterUnderstandSignals.js'");
    expect(routerSource).not.toContain('function understandKeywordMatches');

    const understandSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterUnderstandSignals.ts'),
      'utf8',
    );
    expect(understandSignalsSource).toContain('export function understandKeywordMatches');
  });

  it('keeps keyword scoring isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterScoring.js'");
    expect(scoringSource()).toContain("from './intentRouterKeywordWeights.js'");
    expect(routerSource).not.toContain('function keywordWeight');

    const keywordWeightsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterKeywordWeights.ts'),
      'utf8',
    );
    expect(keywordWeightsSource).toContain('export function keywordWeight');
  });

  it('keeps keyword matching isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(routerSource).toContain("from './intentRouterScoring.js'");
    expect(scoringSource()).toContain("from './intentRouterKeywordMatches.js'");
    expect(routerSource).not.toContain('function routeKeywordMatches');

    const keywordMatchesModuleSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterKeywordMatches.ts'),
      'utf8',
    );
    expect(keywordMatchesModuleSource).toContain('export function routeKeywordMatches');
  });
});
