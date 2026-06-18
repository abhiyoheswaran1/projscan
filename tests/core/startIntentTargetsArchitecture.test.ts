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

    expect(targetSource).toContain(
      "import { extractToolingConfigQuery } from './startIntentToolingConfigQueries.js';",
    );
    expect(targetSource).not.toContain('TOOLING_CONFIG_RULES');
    expect(targetSource).not.toContain('function lockfileQuery');

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

  it('keeps authorization search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const authorizationPath = path.join(
      process.cwd(),
      'src/core/startIntentAuthorizationQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractAuthorizationQuery } from './startIntentAuthorizationQueries.js';",
    );
    expect(targetSource).not.toContain('function extractAuthorizationQuery');
    expect(targetSource).not.toContain('login routes');

    expect(existsSync(authorizationPath)).toBe(true);
    const authorizationSource = readFileSync(authorizationPath, 'utf8');
    expect(authorizationSource).toContain('export function extractAuthorizationQuery');
    expect(authorizationSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps style-system search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const stylePath = path.join(
      process.cwd(),
      'src/core/startIntentStyleSystemQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractStyleSystemQuery } from './startIntentStyleSystemQueries.js';",
    );
    expect(targetSource).not.toContain('function extractStyleSystemQuery');
    expect(targetSource).not.toContain('Tailwind theme');

    expect(existsSync(stylePath)).toBe(true);
    const styleSource = readFileSync(stylePath, 'utf8');
    expect(styleSource).toContain('export function extractStyleSystemQuery');
    expect(styleSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps navigation layout search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const navigationPath = path.join(
      process.cwd(),
      'src/core/startIntentNavigationLayoutQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractNavigationLayoutQuery } from './startIntentNavigationLayoutQueries.js';",
    );
    expect(targetSource).not.toContain('function extractNavigationLayoutQuery');
    expect(targetSource).not.toContain('Next.js layout');

    expect(existsSync(navigationPath)).toBe(true);
    const navigationSource = readFileSync(navigationPath, 'utf8');
    expect(navigationSource).toContain('export function extractNavigationLayoutQuery');
    expect(navigationSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps frontend page route search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const frontendRoutePath = path.join(
      process.cwd(),
      'src/core/startIntentFrontendPageRouteQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractFrontendPageRouteQuery } from './startIntentFrontendPageRouteQueries.js';",
    );
    expect(targetSource).not.toContain('function extractFrontendPageRouteQuery');
    expect(targetSource).not.toContain('not-found page');

    expect(existsSync(frontendRoutePath)).toBe(true);
    const frontendRouteSource = readFileSync(frontendRoutePath, 'utf8');
    expect(frontendRouteSource).toContain('export function extractFrontendPageRouteQuery');
    expect(frontendRouteSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps test data search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const testDataPath = path.join(process.cwd(), 'src/core/startIntentTestDataQueries.ts');

    expect(targetSource).toContain(
      "import { extractTestDataQuery } from './startIntentTestDataQueries.js';",
    );
    expect(targetSource).not.toContain('function extractTestDataQuery');
    expect(targetSource).not.toContain('Storybook stories');

    expect(existsSync(testDataPath)).toBe(true);
    const testDataSource = readFileSync(testDataPath, 'utf8');
    expect(testDataSource).toContain('export function extractTestDataQuery');
    expect(testDataSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps background work search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const backgroundWorkPath = path.join(
      process.cwd(),
      'src/core/startIntentBackgroundWorkQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractBackgroundWorkQuery } from './startIntentBackgroundWorkQueries.js';",
    );
    expect(targetSource).not.toContain('function extractBackgroundWorkQuery');
    expect(targetSource).not.toContain('function isBackgroundWorkTarget');

    expect(existsSync(backgroundWorkPath)).toBe(true);
    const backgroundWorkSource = readFileSync(backgroundWorkPath, 'utf8');
    expect(backgroundWorkSource).toContain('export function extractBackgroundWorkQuery');
    expect(backgroundWorkSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps observability search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const observabilityPath = path.join(
      process.cwd(),
      'src/core/startIntentObservabilityQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractObservabilityQuery } from './startIntentObservabilityQueries.js';",
    );
    expect(targetSource).not.toContain('function extractObservabilityQuery');
    expect(targetSource).not.toContain('function isObservabilityTarget');

    expect(existsSync(observabilityPath)).toBe(true);
    const observabilitySource = readFileSync(observabilityPath, 'utf8');
    expect(observabilitySource).toContain('export function extractObservabilityQuery');
    expect(observabilitySource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps shell argument helpers in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const shellArgsPath = path.join(process.cwd(), 'src/core/startShellArgs.ts');

    expect(targetSource).toContain(
      "import { isPlaceholder, quoteShellArg } from './startShellArgs.js';",
    );
    expect(targetSource).toContain(
      "export { escapeDoubleQuoted, isPlaceholder, quoteShellArg, quoteShellArgOrPlaceholder } from './startShellArgs.js';",
    );
    expect(targetSource).not.toContain('function escapeDoubleQuoted');
    expect(targetSource).not.toContain('function quoteShellArgOrPlaceholder');

    expect(existsSync(shellArgsPath)).toBe(true);
    const shellArgsSource = readFileSync(shellArgsPath, 'utf8');
    expect(shellArgsSource).toContain('export function quoteShellArg');
    expect(shellArgsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps generic target text helpers in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const targetTextPath = path.join(process.cwd(), 'src/core/startIntentTargetText.ts');

    expect(targetSource).toContain(
      "import { isGenericReferenceTarget, unwrapTarget } from './startIntentTargetText.js';",
    );
    expect(targetSource).not.toContain('function unwrapTarget');
    expect(targetSource).not.toContain('function isGenericReferenceTarget');

    expect(existsSync(targetTextPath)).toBe(true);
    const targetTextSource = readFileSync(targetTextPath, 'utf8');
    expect(targetTextSource).toContain('export function unwrapTarget');
    expect(targetTextSource).toContain('export function isGenericReferenceTarget');
    expect(targetTextSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps package target parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const packageTargetsPath = path.join(process.cwd(), 'src/core/startPackageTargets.ts');

    expect(targetSource).toContain("from './startPackageTargets.js';");
    expect(targetSource).toContain(
      "export { extractAuditPackageTarget, extractPackageTarget } from './startPackageTargets.js';",
    );
    expect(targetSource).not.toContain('function extractPackageTarget');
    expect(targetSource).not.toContain('function extractAuditPackageTarget');
    expect(targetSource).not.toContain('function isPackageNameTarget');

    expect(existsSync(packageTargetsPath)).toBe(true);
    const packageTargetsSource = readFileSync(packageTargetsPath, 'utf8');
    expect(packageTargetsSource).toContain('export function extractPackageTarget');
    expect(packageTargetsSource).toContain('export function extractAuditPackageTarget');
    expect(packageTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps issue id target parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const issueTargetsPath = path.join(process.cwd(), 'src/core/startIssueTargets.ts');

    expect(targetSource).toContain("export { extractIssueIdTarget } from './startIssueTargets.js';");
    expect(targetSource).not.toContain('function extractIssueIdTarget');
    expect(targetSource).not.toContain('function isIssueIdTarget');

    expect(existsSync(issueTargetsPath)).toBe(true);
    const issueTargetsSource = readFileSync(issueTargetsPath, 'utf8');
    expect(issueTargetsSource).toContain('export function extractIssueIdTarget');
    expect(issueTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps symbol target parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const symbolTargetsPath = path.join(process.cwd(), 'src/core/startSymbolTargets.ts');

    expect(targetSource).toContain("import { extractSymbolTarget } from './startSymbolTargets.js';");
    expect(targetSource).toContain("export { isExactSymbolTarget } from './startSymbolTargets.js';");
    expect(targetSource).not.toContain('function extractSymbolTarget');
    expect(targetSource).not.toContain('function isSymbolNameTarget');
    expect(targetSource).not.toContain('function isExactSymbolTarget');

    expect(existsSync(symbolTargetsPath)).toBe(true);
    const symbolTargetsSource = readFileSync(symbolTargetsPath, 'utf8');
    expect(symbolTargetsSource).toContain('export function extractSymbolTarget');
    expect(symbolTargetsSource).toContain('export function isExactSymbolTarget');
    expect(symbolTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps file target parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const fileTargetsPath = path.join(process.cwd(), 'src/core/startFileTargets.ts');

    expect(targetSource).toContain("import { extractFileTarget } from './startFileTargets.js';");
    expect(targetSource).toContain(
      "export { extractFileTarget, isFilePathTarget } from './startFileTargets.js';",
    );
    expect(targetSource).not.toContain('function extractFileTarget');
    expect(targetSource).not.toContain('function isFilePathTarget');

    expect(existsSync(fileTargetsPath)).toBe(true);
    const fileTargetsSource = readFileSync(fileTargetsPath, 'utf8');
    expect(fileTargetsSource).toContain('export function extractFileTarget');
    expect(fileTargetsSource).toContain('export function isFilePathTarget');
    expect(fileTargetsSource).not.toContain("from './startIntentTargets.js'");
  });
});
