import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control intent target architecture', () => {
  it('keeps report-scope parsing outside the large generic target module', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const reportScopeSource = readFileSync(
      path.join(process.cwd(), 'src/core/startReportScopeTargets.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "export { extractReportScopeTarget } from './startReportScopeTargets.js';",
    );
    expect(targetSource).not.toContain('REPORT_SCOPE_DIRECTORY_TARGETS');
    expect(targetSource).not.toContain('function extractReportScopeTargets');
    expect(targetSource).not.toContain('function isReportScopePathTarget');

    expect(reportScopeSource).toContain('export function extractReportScopeTarget');
    expect(reportScopeSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps reliability search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const reliabilitySource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentReliabilityQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';",
    );
    expect(targetSource).not.toContain('function extractRateLimitQuery');
    expect(targetSource).not.toContain('function extractResiliencePatternQuery');

    expect(reliabilitySource).toContain('export function extractReliabilityQuery');
    expect(reliabilitySource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps data-contract search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const dataContractSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentDataContractQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractDataContractQuery } from './startIntentDataContractQueries.js';",
    );
    expect(targetSource).not.toContain('function extractValidationQuery');
    expect(targetSource).not.toContain('function extractDatabaseConsistencyQuery');

    expect(dataContractSource).toContain('export function extractDataContractQuery');
    expect(dataContractSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps UI interaction search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const uiInteractionSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentUiInteractionQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';",
    );
    expect(targetSource).not.toContain('UI_INTERACTION_RULES');
    expect(targetSource).not.toContain('function fixedUiInteractionQuery');

    expect(uiInteractionSource).toContain('export function extractUiInteractionQuery');
    expect(uiInteractionSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps state-management search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const stateSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentStateManagementQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';",
    );
    expect(targetSource).not.toContain('STATE_MANAGEMENT_RULES');
    expect(targetSource).not.toContain('function normalizeStateFramework');

    expect(stateSource).toContain('export function extractStateManagementQuery');
    expect(stateSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps data-access search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const dataAccessPath = path.join(
      process.cwd(),
      'src/core/startIntentDataAccessQueries.ts',
    );

    expect(targetSource).toContain(
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
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const integrationPath = path.join(
      process.cwd(),
      'src/core/startIntentIntegrationQueries.ts',
    );

    expect(targetSource).toContain(
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
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const apiContractPath = path.join(
      process.cwd(),
      'src/core/startIntentApiContractQueries.ts',
    );

    expect(targetSource).toContain(
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
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const infraPath = path.join(
      process.cwd(),
      'src/core/startIntentInfraArtifactQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractInfraArtifactQuery } from './startIntentInfraArtifactQueries.js';",
    );
    expect(targetSource).not.toContain('INFRA_ARTIFACT_RULES');
    expect(targetSource).not.toContain('function normalizeInfraTarget');

    expect(existsSync(infraPath)).toBe(true);
    const infraSource = readFileSync(infraPath, 'utf8');
    expect(infraSource).toContain('export function extractInfraArtifactQuery');
    expect(infraSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps tooling config search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const toolingPath = path.join(
      process.cwd(),
      'src/core/startIntentToolingConfigQueries.ts',
    );
    const generatedConfigPath = path.join(
      process.cwd(),
      'src/core/startGeneratedConfigSearchTargets.ts',
    );

    expect(targetSource).toContain(
      "import { searchQueryFromGeneratedAndConfig } from './startGeneratedConfigSearchTargets.js';",
    );
    expect(targetSource).not.toContain('extractToolingConfigQuery');
    expect(targetSource).not.toContain('TOOLING_CONFIG_RULES');
    expect(targetSource).not.toContain('function lockfileQuery');

    expect(existsSync(generatedConfigPath)).toBe(true);
    const generatedConfigSource = readFileSync(generatedConfigPath, 'utf8');
    expect(generatedConfigSource).toContain(
      "import { extractToolingConfigQuery } from './startIntentToolingConfigQueries.js';",
    );
    expect(existsSync(toolingPath)).toBe(true);
    const toolingSource = readFileSync(toolingPath, 'utf8');
    expect(toolingSource).toContain('export function extractToolingConfigQuery');
    expect(toolingSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps domain workflow search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const domainPath = path.join(
      process.cwd(),
      'src/core/startIntentDomainWorkflowQueries.ts',
    );

    expect(targetSource).toContain(
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
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const communicationPath = path.join(
      process.cwd(),
      'src/core/startIntentCommunicationArtifactQueries.ts',
    );

    expect(targetSource).toContain(
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
