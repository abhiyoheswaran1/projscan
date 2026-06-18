import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control intent domain search architecture', () => {
  it('keeps the ordered domain signal chain in the domain search helper', () => {
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain('export function searchQueryFromDomainSignals');
    expect(domainSearchSource).toContain(
      "import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';",
    );
    expect(domainSearchSource).toContain(
      "import { extractDomainWorkflowQuery } from './startIntentDomainWorkflowQueries.js';",
    );
    expect(domainSearchSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps reliability search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const reliabilitySource = readSource('src/core/startIntentReliabilityQueries.ts');
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';",
    );
    expect(targetSource).not.toContain('function extractRateLimitQuery');
    expect(targetSource).not.toContain('function extractResiliencePatternQuery');

    expect(reliabilitySource).toContain('export function extractReliabilityQuery');
    expect(reliabilitySource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps data-contract search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const dataContractSource = readSource('src/core/startIntentDataContractQueries.ts');
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractDataContractQuery } from './startIntentDataContractQueries.js';",
    );
    expect(targetSource).not.toContain('function extractValidationQuery');
    expect(targetSource).not.toContain('function extractDatabaseConsistencyQuery');

    expect(dataContractSource).toContain('export function extractDataContractQuery');
    expect(dataContractSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps UI interaction search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const uiInteractionSource = readSource('src/core/startIntentUiInteractionQueries.ts');
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';",
    );
    expect(targetSource).not.toContain('UI_INTERACTION_RULES');
    expect(targetSource).not.toContain('function fixedUiInteractionQuery');

    expect(uiInteractionSource).toContain('export function extractUiInteractionQuery');
    expect(uiInteractionSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps state-management search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const stateSource = readSource('src/core/startIntentStateManagementQueries.ts');
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';",
    );
    expect(targetSource).not.toContain('STATE_MANAGEMENT_RULES');
    expect(targetSource).not.toContain('function normalizeStateFramework');

    expect(stateSource).toContain('export function extractStateManagementQuery');
    expect(stateSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps data-access search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const dataAccessPath = path.join(
      process.cwd(),
      'src/core/startIntentDataAccessQueries.ts',
    );
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractDataAccessQuery } from './startIntentDataAccessQueries.js';",
    );
    expect(targetSource).not.toContain('DATA_ACCESS_RULES');
    expect(targetSource).not.toContain('function normalizeDataAccessFramework');

    expect(existsSync(dataAccessPath)).toBe(true);
    const dataAccessSource = readFileSync(dataAccessPath, 'utf8');
    expect(dataAccessSource).toContain('export function extractDataAccessQuery');
    expect(dataAccessSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps integration search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const integrationPath = path.join(
      process.cwd(),
      'src/core/startIntentIntegrationQueries.ts',
    );
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractIntegrationQuery } from './startIntentIntegrationQueries.js';",
    );
    expect(targetSource).not.toContain('function serviceCallIntegrationQuery');
    expect(targetSource).not.toContain('function normalizeIntegrationPhrase');

    expect(existsSync(integrationPath)).toBe(true);
    const integrationSource = readFileSync(integrationPath, 'utf8');
    expect(integrationSource).toContain('export function extractIntegrationQuery');
    expect(integrationSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps API contract search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const apiContractPath = path.join(
      process.cwd(),
      'src/core/startIntentApiContractQueries.ts',
    );
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractApiContractQuery } from './startIntentApiContractQueries.js';",
    );
    expect(targetSource).not.toContain('API_CONTRACT_RULES');
    expect(targetSource).not.toContain('function graphQlSchemaQuery');

    expect(existsSync(apiContractPath)).toBe(true);
    const apiContractSource = readFileSync(apiContractPath, 'utf8');
    expect(apiContractSource).toContain('export function extractApiContractQuery');
    expect(apiContractSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps infrastructure artifact search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const infraPath = path.join(
      process.cwd(),
      'src/core/startIntentInfraArtifactQueries.ts',
    );
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractInfraArtifactQuery } from './startIntentInfraArtifactQueries.js';",
    );
    expect(targetSource).not.toContain('INFRA_ARTIFACT_RULES');
    expect(targetSource).not.toContain('function normalizeInfraTarget');

    expect(existsSync(infraPath)).toBe(true);
    const infraSource = readFileSync(infraPath, 'utf8');
    expect(infraSource).toContain('export function extractInfraArtifactQuery');
    expect(infraSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps domain workflow search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const domainPath = path.join(
      process.cwd(),
      'src/core/startIntentDomainWorkflowQueries.ts',
    );
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractDomainWorkflowQuery } from './startIntentDomainWorkflowQueries.js';",
    );
    expect(targetSource).not.toContain('function extractDomainWorkflowQuery');
    expect(targetSource).not.toContain('subscription\\s+renewal');

    expect(existsSync(domainPath)).toBe(true);
    const domainSource = readFileSync(domainPath, 'utf8');
    expect(domainSource).toContain('export function extractDomainWorkflowQuery');
    expect(domainSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps communication artifact search query parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const communicationPath = path.join(
      process.cwd(),
      'src/core/startIntentCommunicationArtifactQueries.ts',
    );
    const domainSearchSource = readDomainSearchSource();

    expect(domainSearchSource).toContain(
      "import { extractCommunicationArtifactQuery } from './startIntentCommunicationArtifactQueries.js';",
    );
    expect(targetSource).not.toContain('function extractCommunicationArtifactQuery');
    expect(targetSource).not.toContain('SMS verification template');

    expect(existsSync(communicationPath)).toBe(true);
    const communicationSource = readFileSync(communicationPath, 'utf8');
    expect(communicationSource).toContain('export function extractCommunicationArtifactQuery');
    expect(communicationSource).not.toContain("from './startIntentTargets.js'");
  });
});

function readTargetSource(): string {
  return readSource('src/core/startIntentTargets.ts');
}

function readDomainSearchSource(): string {
  return readSource('src/core/startIntentDomainSearchQueries.ts');
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
