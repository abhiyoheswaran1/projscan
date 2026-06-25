import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('routeIntent search architecture', () => {
  const keywordMatchesSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordMatches.ts'), 'utf8');
  const searchGuardsSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordSearchGuards.ts'), 'utf8');
  const toolGuardsSource = () =>
    readFileSync(path.join(process.cwd(), 'src/core/intentRouterKeywordToolGuards.ts'), 'utf8');

  it('keeps dataflow and privacy keyword routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    const earlyGuardsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterKeywordEarlyGuards.ts'),
      'utf8',
    );
    expect(earlyGuardsSource).toContain("from './intentRouterSecuritySignals.js'");
    expect(routerSource).not.toContain('function dataflowKeywordMatches');
    expect(routerSource).not.toContain('function privacyCheckKeywordMatches');
    expect(routerSource).not.toContain('function explicitDataflowContextMatches');
    expect(routerSource).not.toContain('function explicitDataflowRiskContextMatches');

    const securitySignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSecuritySignals.ts'),
      'utf8',
    );
    expect(securitySignalsSource).toContain('export function dataflowKeywordMatches');
    expect(securitySignalsSource).toContain('export function privacyCheckKeywordMatches');
    expect(securitySignalsSource).toContain('export function explicitDataflowContextMatches');
    expect(securitySignalsSource).toContain('export function explicitDataflowRiskContextMatches');
  });

  it('keeps early keyword rejection guards isolated from the keyword dispatcher', () => {
    const keywordSource = keywordMatchesSource();

    expect(keywordSource).toContain("from './intentRouterKeywordEarlyGuards.js'");
    expect(keywordSource).not.toContain('function understandKeywordRejected');
    expect(keywordSource).not.toContain('function dataflowKeywordRejected');

    const earlyGuardsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterKeywordEarlyGuards.ts'),
      'utf8',
    );
    expect(earlyGuardsSource).toContain('export function routeKeywordRejectedByEarlyGuards');
    expect(earlyGuardsSource).toContain('function understandKeywordRejected');
    expect(earlyGuardsSource).toContain('function dataflowKeywordRejected');
  });

  it('keeps target keyword guard decisions isolated from the keyword dispatcher', () => {
    const keywordSource = keywordMatchesSource();

    expect(keywordSource).toContain("from './intentRouterKeywordTargetGuards.js'");
    expect(keywordSource).not.toContain('function targetKeywordDecision');
    expect(keywordSource).not.toContain('function impactKeywordDecision');

    const targetGuardsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterKeywordTargetGuards.ts'),
      'utf8',
    );
    expect(targetGuardsSource).toContain('export function routeKeywordTargetGuardDecision');
    expect(targetGuardsSource).toContain('function targetKeywordDecision');
    expect(targetGuardsSource).toContain('function impactKeywordDecision');
  });

  it('keeps search keyword guard decisions isolated from the keyword dispatcher', () => {
    const keywordSource = keywordMatchesSource();

    expect(keywordSource).toContain("from './intentRouterKeywordSearchGuards.js'");
    expect(keywordSource).not.toContain("entry.tool === 'projscan_search'");
    expect(keywordSource).not.toContain('searchFeatureFlagContextMatches(tokens)');

    const guardSource = searchGuardsSource();
    expect(guardSource).toContain('export function routeKeywordSearchGuardDecision');
    expect(guardSource).toContain('function searchKeywordDecision');
    expect(guardSource).toContain('searchFeatureFlagContextMatches');
  });

  it('keeps tool keyword guard decisions isolated from the keyword dispatcher', () => {
    const keywordSource = keywordMatchesSource();

    expect(keywordSource).toContain("from './intentRouterKeywordToolGuards.js'");
    expect(keywordSource).not.toContain("entry.tool === 'projscan_pr_diff'");
    expect(keywordSource).not.toContain("keyword === 'ready'");
    expect(keywordSource).not.toContain('releaseTrainKeywordMatches(keyword');

    const guardSource = toolGuardsSource();
    expect(guardSource).toContain('export function routeKeywordToolGuardDecision');
    expect(guardSource).toContain('function toolKeywordDecision');
    expect(guardSource).toContain('prDiffKeywordMatches');
  });

  it('keeps product guard signal helpers isolated from the tool guard table', () => {
    const guardSource = toolGuardsSource();
    const productSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterProductGuardSignals.ts'),
      'utf8',
    );

    expect(guardSource).toContain("from './intentRouterProductGuardSignals.js'");
    expect(guardSource).not.toContain('function feedbackIntakeContextMatches');
    expect(guardSource).not.toContain('function proveContextMatches');
    expect(guardSource).not.toContain('function reportControlContextMatches');
    expect(productSignalsSource).toContain('export function feedbackIntakeContextMatches');
    expect(productSignalsSource).toContain('export function proveContextMatches');
    expect(productSignalsSource).toContain('export function reportControlContextMatches');
    expect(productSignalsSource).not.toContain("from './intentRouterKeywordToolGuards.js'");
  });

  it('keeps infra artifact search routing isolated from the main router', () => {
    const routerSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouter.ts'),
      'utf8',
    );
    expect(searchGuardsSource()).toContain("from './intentRouterSearchInfraSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchUiSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchReliabilitySignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchStyleSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchIntegrationSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchApiSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchCommunicationSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchStateSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchDomainSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchPageSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchToolingSignals.js'");
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
    expect(searchGuardsSource()).toContain("from './intentRouterSearchNavigationSignals.js'");
    expect(routerSource).not.toContain('function searchNavigationLayoutContextMatches');

    const navigationSignalsSource = readFileSync(
      path.join(process.cwd(), 'src/core/intentRouterSearchNavigationSignals.ts'),
      'utf8',
    );
    expect(navigationSignalsSource).toContain(
      'export function searchNavigationLayoutContextMatches',
    );
  });
});
