import { extractApiContractQuery } from './startIntentApiContractQueries.js';
import { extractAuthorizationQuery } from './startIntentAuthorizationQueries.js';
import { extractBackgroundWorkQuery } from './startIntentBackgroundWorkQueries.js';
import { extractCommunicationArtifactQuery } from './startIntentCommunicationArtifactQueries.js';
import { extractDataAccessQuery } from './startIntentDataAccessQueries.js';
import { extractDataContractQuery } from './startIntentDataContractQueries.js';
import { extractDomainWorkflowQuery } from './startIntentDomainWorkflowQueries.js';
import { extractFrontendPageRouteQuery } from './startIntentFrontendPageRouteQueries.js';
import { extractInfraArtifactQuery } from './startIntentInfraArtifactQueries.js';
import { extractIntegrationQuery } from './startIntentIntegrationQueries.js';
import { extractNavigationLayoutQuery } from './startIntentNavigationLayoutQueries.js';
import { extractObservabilityQuery } from './startIntentObservabilityQueries.js';
import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';
import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';
import { extractStyleSystemQuery } from './startIntentStyleSystemQueries.js';
import { extractTestDataQuery } from './startIntentTestDataQueries.js';
import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';

type QueryExtractor = (intent: string) => string | undefined;

function firstQuery(intent: string, extractors: readonly QueryExtractor[]): string | undefined {
  for (const extract of extractors) {
    const query = extract(intent);
    if (query) return query;
  }
  return undefined;
}

export function searchQueryFromDomainSignals(trimmed: string): string | undefined {
  return firstQuery(trimmed, [
    extractObservabilityQuery,
    extractBackgroundWorkQuery,
    extractTestDataQuery,
    extractAuthorizationQuery,
    extractReliabilityQuery,
    extractDataContractQuery,
    extractUiInteractionQuery,
    extractStyleSystemQuery,
    extractNavigationLayoutQuery,
    extractFrontendPageRouteQuery,
    extractStateManagementQuery,
    extractDataAccessQuery,
    extractIntegrationQuery,
    extractApiContractQuery,
    extractInfraArtifactQuery,
    extractCommunicationArtifactQuery,
    extractDomainWorkflowQuery,
  ]);
}
