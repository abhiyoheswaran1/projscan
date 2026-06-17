import {
  claimContextMatches,
  claimKeywordMatches,
  collisionChangeContextMatches,
  collisionConflictContextMatches,
  coordinateActiveContextMatches,
  coordinateAgentContextMatches,
  coordinateConflictContextMatches,
  coordinateWorkingContextMatches,
  mergeRiskKeywordMatches,
  sessionAgentContextMatches,
  sessionAwayContextMatches,
  sessionLeaveOffContextMatches,
} from './intentRouterCoordinationSignals.js';
import {
  auditKeywordMatches,
  couplingKeywordMatches,
  dependenciesKeywordMatches,
  dependencyCycleContextMatches,
  outdatedNpmContextMatches,
  packageDependencyLookupContextMatches,
  packageImporterContextMatches,
  workspacesKeywordMatches,
} from './intentRouterDependencySignals.js';
import {
  evidencePackKeywordMatches,
  reviewKeywordMatches,
} from './intentRouterReviewSignals.js';
import {
  dataAccessPlanningContextMatches,
  domainWorkflowPlanningContextMatches,
  stateManagementPlanningContextMatches,
} from './intentRouterPlanningSignals.js';
import {
  preflightBranchRecoveryContextMatches,
  preflightReadyContextMatches,
  preflightRiskContextMatches,
} from './intentRouterPreflightSignals.js';
import { prDiffKeywordMatches } from './intentRouterPrDiffSignals.js';
import {
  regressionLocalSetupContextMatches,
  styleSystemFailureContextMatches,
  toolingFailureContextMatches,
} from './intentRouterRegressionSignals.js';
import { regressionKeywordMatches } from './intentRouterRegressionKeywordMatches.js';
import { localServiceSetupCommandContextMatches } from './intentRouterRepoSignals.js';
import { releaseTrainKeywordMatches } from './intentRouterReleaseSignals.js';
import {
  doctorCleanupDeleteContextMatches,
  doctorCleanupDiscoveryContextMatches,
  fileHistoryContextMatches,
  fileTestContextMatches,
  hotspotFileRiskContextMatches,
  hotspotPerformanceContextMatches,
  hotspotWhereContextMatches,
  impactApiContextMatches,
  impactApiKeywordMatches,
  impactDatabaseContextMatches,
  impactDeleteContextMatches,
  impactRollbackContextMatches,
} from './intentRouterRiskSignals.js';
import {
  dataflowKeywordMatches,
  explicitDataflowContextMatches,
  explicitDataflowRiskContextMatches,
  privacyCheckKeywordMatches,
} from './intentRouterSecuritySignals.js';
import { searchApiContractContextMatches } from './intentRouterSearchApiSignals.js';
import { searchBackgroundWorkContextMatches } from './intentRouterSearchBackgroundSignals.js';
import { searchCommunicationArtifactContextMatches } from './intentRouterSearchCommunicationSignals.js';
import {
  searchDataAccessContextMatches,
  searchDataContractContextMatches,
} from './intentRouterSearchDataSignals.js';
import { searchDomainWorkflowContextMatches } from './intentRouterSearchDomainSignals.js';
import { searchInfraArtifactContextMatches } from './intentRouterSearchInfraSignals.js';
import { searchIntegrationContextMatches } from './intentRouterSearchIntegrationSignals.js';
import {
  searchAuthorizationContextMatches,
  searchConfigLookupContextMatches,
  searchDocumentationContextMatches,
  searchEnvLookupContextMatches,
  searchFeatureFlagContextMatches,
  searchGeneratedContextMatches,
  searchMigrationLookupContextMatches,
  searchObservabilityContextMatches,
  searchQuotedDebugTextContextMatches,
  searchRouteHandlerContextMatches,
} from './intentRouterSearchLookupSignals.js';
import { searchNavigationLayoutContextMatches } from './intentRouterSearchNavigationSignals.js';
import { searchOwnershipContextMatches } from './intentRouterSearchOwnershipSignals.js';
import { searchFrontendPageRouteContextMatches } from './intentRouterSearchPageSignals.js';
import { searchReliabilityContextMatches } from './intentRouterSearchReliabilitySignals.js';
import { searchStateManagementContextMatches } from './intentRouterSearchStateSignals.js';
import { searchStyleSystemContextMatches } from './intentRouterSearchStyleSignals.js';
import { searchTestDataContextMatches } from './intentRouterSearchTestSignals.js';
import { searchToolingConfigContextMatches } from './intentRouterSearchToolingSignals.js';
import { searchUiInteractionContextMatches } from './intentRouterSearchUiSignals.js';
import {
  coverageKeywordMatches,
  searchCodeLocationContextMatches,
  searchTestLocationContextMatches,
} from './intentRouterVerificationSignals.js';
import {
  bugHuntOpportunityContextMatches,
  bugHuntSpeedContextMatches,
  protectedImproveNextContextMatches,
  workplanKeywordMatches,
} from './intentRouterWorkSignals.js';
import { understandKeywordMatches } from './intentRouterUnderstandSignals.js';

export interface KeywordMatchRouteEntry {
  tool: string;
}

export function routeKeywordMatches(
  entry: KeywordMatchRouteEntry,
  keyword: string,
  tokens: Set<string>,
  hasFilePath: boolean,
  hasPackageRemoval: boolean,
  hasPackageChange: boolean,
  hasEnvVar: boolean,
  hasQuotedText: boolean,
): boolean {
  if (!tokens.has(keyword)) return false;
  if (entry.tool === 'projscan_privacy_check' && searchIntegrationContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_privacy_check' && searchUiInteractionContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_privacy_check' && !privacyCheckKeywordMatches(keyword, tokens))
    return false;
  if (entry.tool === 'projscan_understand' && !understandKeywordMatches(keyword, tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchEnvLookupContextMatches(tokens, hasEnvVar))
    return false;
  if (
    entry.tool === 'projscan_understand' &&
    searchQuotedDebugTextContextMatches(tokens, hasQuotedText)
  )
    return false;
  if (entry.tool === 'projscan_understand' && searchTestDataContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_understand' && searchDataContractContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchUiInteractionContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchIntegrationContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_understand' && searchApiContractContextMatches(tokens)) return false;
  if (
    entry.tool === 'projscan_understand' &&
    searchInfraArtifactContextMatches(tokens) &&
    !localServiceSetupCommandContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_understand' && searchDomainWorkflowContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchCommunicationArtifactContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchStateManagementContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchDataAccessContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_understand' && searchNavigationLayoutContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchFrontendPageRouteContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_understand' && searchStyleSystemContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_review' && !reviewKeywordMatches(keyword, tokens)) return false;
  if (entry.tool === 'projscan_coupling' && !couplingKeywordMatches(keyword, tokens)) return false;
  if (entry.tool === 'projscan_explain_issue' && styleSystemFailureContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_explain_issue' && toolingFailureContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_dataflow' && !dataflowKeywordMatches(keyword, tokens)) return false;
  if (entry.tool === 'projscan_dataflow' && domainWorkflowPlanningContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_dataflow' && stateManagementPlanningContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_dataflow' && dataAccessPlanningContextMatches(tokens)) return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    ['process', 'processes'].includes(keyword) &&
    searchEnvLookupContextMatches(tokens, hasEnvVar)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchQuotedDebugTextContextMatches(tokens, hasQuotedText) &&
    !explicitDataflowContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchBackgroundWorkContextMatches(tokens) &&
    !explicitDataflowContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchObservabilityContextMatches(tokens) &&
    !explicitDataflowContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchTestDataContextMatches(tokens) &&
    !explicitDataflowContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchReliabilityContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchDataContractContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchUiInteractionContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchIntegrationContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchApiContractContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchInfraArtifactContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchDomainWorkflowContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchCommunicationArtifactContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_dataflow' &&
    searchStateManagementContextMatches(tokens) &&
    !explicitDataflowRiskContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_dataflow' && searchDataAccessContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_dataflow' && searchNavigationLayoutContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_dataflow' && searchFrontendPageRouteContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_dataflow' && searchStyleSystemContextMatches(tokens)) return false;
  if (
    hasFilePath &&
    keyword === 'start' &&
    ['projscan_hotspots', 'projscan_start'].includes(entry.tool)
  )
    return false;
  if (entry.tool === 'projscan_file' && keyword === 'read') return hasFilePath;
  if (entry.tool === 'projscan_file' && ['review', 'reviewer', 'reviewers'].includes(keyword))
    return hasFilePath;
  if (entry.tool === 'projscan_file' && keyword === 'owns') return hasFilePath;
  if (entry.tool === 'projscan_file' && ['risk', 'risks', 'risky', 'dangerous'].includes(keyword))
    return hasFilePath;
  if (
    entry.tool === 'projscan_file' &&
    [
      'last',
      'touched',
      'touch',
      'changed',
      'recently',
      'history',
      'author',
      'authors',
      'blame',
    ].includes(keyword)
  ) {
    return hasFilePath && fileHistoryContextMatches(tokens);
  }
  if (
    entry.tool === 'projscan_file' &&
    ['add', 'write', 'coverage', 'covered', 'uncovered', 'test', 'tests'].includes(keyword)
  ) {
    return hasFilePath && fileTestContextMatches(tokens);
  }
  if (
    entry.tool === 'projscan_file' &&
    keyword === 'file' &&
    searchConfigLookupContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_file' &&
    keyword === 'file' &&
    searchToolingConfigContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_hotspots' && searchUiInteractionContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_hotspots' && searchNavigationLayoutContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_hotspots' && searchFrontendPageRouteContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_hotspots' && searchStyleSystemContextMatches(tokens)) return false;
  if (
    entry.tool === 'projscan_hotspots' &&
    ['where', 'start'].includes(keyword) &&
    !hotspotWhereContextMatches(tokens, hasFilePath)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    ['delete', 'remove'].includes(keyword) &&
    !hasFilePath &&
    !impactDeleteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    hasEnvVar &&
    [
      'depends',
      'affect',
      'callers',
      'used',
      'usage',
      'referenced',
      'called',
      'api',
      'apis',
    ].includes(keyword)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    ['used', 'usage', 'referenced', 'called'].includes(keyword) &&
    searchTestDataContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    ['used', 'usage', 'referenced', 'called'].includes(keyword) &&
    searchReliabilityContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    ['drop', 'schema', 'table', 'column', 'database', 'db', 'migration', 'migrations'].includes(
      keyword,
    ) &&
    searchDataContractContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    ['drop', 'schema', 'table', 'column', 'database', 'db', 'migration', 'migrations'].includes(
      keyword,
    ) &&
    !impactDatabaseContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    impactApiKeywordMatches(keyword) &&
    !impactApiContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_impact' &&
    ['revert', 'rollback', 'undo', 'backout', 'back', 'out', 'recover'].includes(keyword) &&
    !impactRollbackContextMatches(keyword, tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['uses', 'depend', 'depends', 'installed'].includes(keyword) &&
    !packageDependencyLookupContextMatches(tokens, hasFilePath)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['defined', 'definition'].includes(keyword) &&
    searchBackgroundWorkContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['defined', 'definition'].includes(keyword) &&
    searchTestDataContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['defined', 'definition'].includes(keyword) &&
    searchAuthorizationContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['defined', 'definition'].includes(keyword) &&
    searchDataContractContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['defined', 'definition'].includes(keyword) &&
    searchDataAccessContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    ['defined', 'definition'].includes(keyword) &&
    searchStyleSystemContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_doctor' &&
    ['safe', 'safely', 'delete', 'remove'].includes(keyword) &&
    !doctorCleanupDeleteContextMatches(tokens, hasFilePath, hasPackageRemoval)
  )
    return false;
  if (entry.tool === 'projscan_evidence_pack' && !evidencePackKeywordMatches(keyword, tokens))
    return false;
  if (
    entry.tool === 'projscan_search' &&
    ['search', 'find', 'locate', 'where', 'show', 'code'].includes(keyword) &&
    doctorCleanupDiscoveryContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    ['test', 'tests', 'spec', 'specs', 'cover', 'covers', 'covering'].includes(keyword) &&
    !searchTestLocationContextMatches(tokens, hasFilePath)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    ['feature', 'features', 'flag', 'flags'].includes(keyword) &&
    !searchFeatureFlagContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'env',
      'var',
      'vars',
      'variable',
      'variables',
      'process',
      'used',
      'controls',
      'control',
    ].includes(keyword) &&
    !searchEnvLookupContextMatches(tokens, hasEnvVar) &&
    !searchTestDataContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'error',
      'errors',
      'message',
      'messages',
      'throw',
      'throws',
      'thrown',
      'log',
      'logs',
      'logged',
      'logging',
    ].includes(keyword) &&
    !searchQuotedDebugTextContextMatches(tokens, hasQuotedText) &&
    !searchObservabilityContextMatches(tokens) &&
    !searchUiInteractionContextMatches(tokens) &&
    !searchDomainWorkflowContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    keyword === 'check' &&
    !searchObservabilityContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'metric',
      'metrics',
      'prometheus',
      'analytics',
      'event',
      'events',
      'alert',
      'alerts',
      'sentry',
      'datadog',
      'dashboard',
      'dashboards',
      'emit',
      'emits',
      'emitted',
      'send',
      'sends',
      'initialize',
      'initialise',
      'init',
    ].includes(keyword) &&
    !searchObservabilityContextMatches(tokens) &&
    !searchIntegrationContextMatches(tokens) &&
    !searchCommunicationArtifactContextMatches(tokens) &&
    !searchNavigationLayoutContextMatches(tokens) &&
    !searchFrontendPageRouteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'input',
      'validation',
      'validate',
      'validates',
      'validator',
      'schema',
      'schemas',
      'zod',
      'params',
      'param',
      'query',
      'queries',
      'parsed',
      'json',
      'serialize',
      'serializes',
      'serialization',
      'response',
      'format',
      'formats',
      'formatting',
      'date',
      'transaction',
      'transactions',
      'wrap',
      'wraps',
      'started',
      'database',
      'db',
      'lock',
      'locks',
      'locking',
      'row',
      'optimistic',
      'unique',
      'uniqueness',
      'enforced',
      'email',
      'pagination',
      'cursor',
      'cursors',
      'builds',
    ].includes(keyword) &&
    !searchDataContractContextMatches(tokens) &&
    !searchIntegrationContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens) &&
    !searchCommunicationArtifactContextMatches(tokens) &&
    !searchStateManagementContextMatches(tokens) &&
    !searchDataAccessContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'openapi',
      'swagger',
      'trpc',
      'grpc',
      'protobuf',
      'proto',
      'protos',
      'router',
      'routers',
      'resolver',
      'resolvers',
    ].includes(keyword) &&
    !searchApiContractContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'docker',
      'dockerfile',
      'compose',
      'containerfile',
      'kubernetes',
      'k8s',
      'manifest',
      'manifests',
      'helm',
      'chart',
      'charts',
      'terraform',
      'tf',
      'module',
      'modules',
      'cloudformation',
      'cdk',
      'pulumi',
      'vercel',
      'netlify',
      'railway',
      'fly',
      'workflow',
      'workflows',
      'deploy',
      'deploys',
      'deployment',
      'staging',
      'production',
    ].includes(keyword) &&
    !searchInfraArtifactContextMatches(tokens) &&
    !searchStyleSystemContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'password',
      'reset',
      'invite',
      'invites',
      'onboarding',
      'flow',
      'flows',
      'csv',
      'export',
      'exports',
      'audit',
      'entries',
      'refund',
      'handling',
      'payments',
      'subscription',
      'renewal',
      'users',
    ].includes(keyword) &&
    !searchDomainWorkflowContextMatches(tokens) &&
    !searchDataAccessContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'welcome',
      'template',
      'templates',
      'copy',
      'push',
      'sms',
      'verification',
      'receipt',
      'invoice',
      'pdf',
    ].includes(keyword) &&
    !searchCommunicationArtifactContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'store',
      'stores',
      'stored',
      'redux',
      'slice',
      'slices',
      'selector',
      'selectors',
      'zustand',
      'jotai',
      'recoil',
      'context',
      'provider',
      'providers',
      'supplies',
      'supplied',
      'provides',
      'provided',
      'hook',
      'hooks',
      'react',
      'mutation',
      'mutations',
      'fetches',
      'fetched',
      'invoices',
    ].includes(keyword) &&
    !searchStateManagementContextMatches(tokens) &&
    !searchDataAccessContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'prisma',
      'drizzle',
      'typeorm',
      'sequelize',
      'sql',
      'model',
      'models',
      'entity',
      'entities',
      'repository',
      'repositories',
      'dao',
      'daos',
      'saves',
      'save',
      'persist',
      'persists',
      'orders',
    ].includes(keyword) &&
    !searchDataAccessContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'sidebar',
      'nav',
      'navigation',
      'menu',
      'item',
      'items',
      'breadcrumb',
      'breadcrumbs',
      'layout',
      'next',
      'js',
      'title',
      'metadata',
      'meta',
      'billing',
      'settings',
      'checkout',
    ].includes(keyword) &&
    !searchNavigationLayoutContextMatches(tokens) &&
    !searchFrontendPageRouteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    ['segment', 'segments', 'not', 'found', '404'].includes(keyword) &&
    !searchFrontendPageRouteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'design',
      'token',
      'tokens',
      'tailwind',
      'theme',
      'themes',
      'css',
      'global',
      'imported',
      'style',
      'styles',
      'styled',
      'class',
      'classes',
      'dark',
      'mode',
      'breakpoint',
      'breakpoints',
      'color',
      'colors',
    ].includes(keyword) &&
    !searchStyleSystemContextMatches(tokens) &&
    !searchStateManagementContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'form',
      'forms',
      'submit',
      'submits',
      'submitted',
      'loading',
      'state',
      'empty',
      'results',
      'boundary',
      'toast',
      'notification',
      'notifications',
      'success',
      'keyboard',
      'shortcut',
      'shortcuts',
      'command',
      'palette',
      'action',
      'actions',
      'modal',
      'opened',
      'component',
      'page',
      'i18n',
      'translation',
      'translations',
      'aria',
      'label',
      'button',
      'buttons',
      'focus',
      'trap',
    ].includes(keyword) &&
    !searchUiInteractionContextMatches(tokens) &&
    !searchIntegrationContextMatches(tokens) &&
    !searchCommunicationArtifactContextMatches(tokens) &&
    !searchStateManagementContextMatches(tokens) &&
    !searchNavigationLayoutContextMatches(tokens) &&
    !searchFrontendPageRouteContextMatches(tokens) &&
    !searchStyleSystemContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'call',
      'calls',
      'called',
      'client',
      'clients',
      'sdk',
      'sdks',
      'integration',
      'integrations',
      'stripe',
      'sendgrid',
      's3',
      'github',
      'graphql',
      'websocket',
      'websockets',
      'socket',
      'sockets',
      'connection',
      'connections',
      'rest',
      'http',
      'fetch',
      'axios',
      'external',
      'service',
      'services',
      'upload',
      'uploads',
      'uploaded',
      'sent',
      'opened',
    ].includes(keyword) &&
    !searchIntegrationContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens) &&
    !searchInfraArtifactContextMatches(tokens) &&
    !searchStateManagementContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'rate',
      'rates',
      'limit',
      'limits',
      'limiting',
      'throttle',
      'throttling',
      'cache',
      'caches',
      'cached',
      'redis',
      'invalidate',
      'invalidates',
      'invalidated',
      'invalidation',
      'retry',
      'retries',
      'retried',
      'backoff',
      'timeout',
      'timeouts',
      'request',
      'requests',
      'failed',
      'set',
      'sets',
      'circuit',
      'breaker',
      'idempotency',
      'idempotent',
      'key',
      'keys',
      'signature',
      'signatures',
      'verified',
      'verify',
      'verification',
      'debounce',
      'debounced',
      'protect',
      'protects',
    ].includes(keyword) &&
    !searchReliabilityContextMatches(tokens) &&
    !searchDataContractContextMatches(tokens) &&
    !searchCommunicationArtifactContextMatches(tokens) &&
    !searchNavigationLayoutContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'permission',
      'permissions',
      'checked',
      'role',
      'roles',
      'access',
      'admin',
      'guard',
      'guards',
      'authorization',
      'authorize',
      'authorized',
      'policy',
      'policies',
      'rbac',
      'require',
      'requires',
      'required',
      'login',
    ].includes(keyword) &&
    !searchAuthorizationContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'seed',
      'seeds',
      'data',
      'fixture',
      'fixtures',
      'mock',
      'mocks',
      'factory',
      'factories',
      'storybook',
      'story',
      'stories',
      'render',
      'renders',
      'rendered',
    ].includes(keyword) &&
    !searchTestDataContextMatches(tokens) &&
    !searchUiInteractionContextMatches(tokens) &&
    !searchNavigationLayoutContextMatches(tokens) &&
    !searchFrontendPageRouteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'background',
      'job',
      'jobs',
      'cron',
      'scheduled',
      'schedule',
      'scheduler',
      'schedulers',
      'worker',
      'workers',
      'queue',
      'queues',
      'processor',
      'processors',
      'task',
      'tasks',
      'defined',
      'processes',
    ].includes(keyword) &&
    !searchBackgroundWorkContextMatches(tokens) &&
    !searchTestDataContextMatches(tokens) &&
    !searchAuthorizationContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens) &&
    !searchStyleSystemContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    ['config', 'configuration', 'alias', 'aliases', 'define', 'defines'].includes(keyword) &&
    !searchConfigLookupContextMatches(tokens) &&
    !searchToolingConfigContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens) &&
    !searchInfraArtifactContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'tsconfig',
      'typescript',
      'vite',
      'vitest',
      'jest',
      'babel',
      'webpack',
      'pnpm',
      'yarn',
      'npm',
      'package',
      'manager',
      'workspace',
      'workspaces',
      'lockfile',
      'lockfiles',
      'path',
      'paths',
    ].includes(keyword) &&
    !searchToolingConfigContextMatches(tokens) &&
    !searchConfigLookupContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    ['api', 'apis', 'route', 'routes', 'endpoint', 'endpoints'].includes(keyword) &&
    !searchRouteHandlerContextMatches(tokens) &&
    !searchAuthorizationContextMatches(tokens) &&
    !searchDataContractContextMatches(tokens) &&
    !searchIntegrationContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens) &&
    !searchNavigationLayoutContextMatches(tokens) &&
    !searchFrontendPageRouteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'migration',
      'migrations',
      'generated',
      'exist',
      'exists',
      'ran',
      'show',
      'file',
      'files',
    ].includes(keyword) &&
    !searchMigrationLookupContextMatches(tokens) &&
    !searchGeneratedContextMatches(tokens) &&
    !searchConfigLookupContextMatches(tokens) &&
    !searchToolingConfigContextMatches(tokens) &&
    !searchBackgroundWorkContextMatches(tokens) &&
    !searchTestDataContextMatches(tokens) &&
    !searchDataContractContextMatches(tokens) &&
    !searchCommunicationArtifactContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'code',
      'handles',
      'handled',
      'handler',
      'contains',
      'logic',
      'implemented',
      'configured',
      'created',
      'creates',
      'loaded',
      'loader',
      'parse',
      'parses',
      'parsed',
      'middleware',
    ].includes(keyword) &&
    !searchCodeLocationContextMatches(tokens) &&
    !searchGeneratedContextMatches(tokens) &&
    !searchRouteHandlerContextMatches(tokens) &&
    !searchReliabilityContextMatches(tokens) &&
    !searchDataContractContextMatches(tokens) &&
    !searchUiInteractionContextMatches(tokens) &&
    !searchIntegrationContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens) &&
    !searchDomainWorkflowContextMatches(tokens) &&
    !searchDataAccessContextMatches(tokens) &&
    !searchFrontendPageRouteContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'owner',
      'owners',
      'ownership',
      'owns',
      'team',
      'area',
      'ask',
      'help',
      'knows',
      'expert',
      'experts',
      'contact',
      'contacts',
    ].includes(keyword) &&
    !searchOwnershipContextMatches(tokens, hasFilePath, claimContextMatches(tokens)) &&
    !searchDomainWorkflowContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_search' &&
    [
      'doc',
      'docs',
      'document',
      'documentation',
      'documented',
      'readme',
      'examples',
      'example',
      'guide',
    ].includes(keyword) &&
    !searchDocumentationContextMatches(tokens) &&
    !searchApiContractContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_pr_diff' && !prDiffKeywordMatches(keyword, tokens)) return false;
  if (entry.tool === 'projscan_coverage' && !coverageKeywordMatches(keyword, tokens)) return false;
  if (entry.tool === 'projscan_dependencies' && !dependenciesKeywordMatches(keyword, tokens))
    return false;
  if (
    ['projscan_audit', 'projscan_outdated', 'projscan_upgrade'].includes(entry.tool) &&
    ['dependency', 'dependencies', 'package', 'packages'].includes(keyword) &&
    dependencyCycleContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_audit' && !auditKeywordMatches(keyword, tokens)) return false;
  if (entry.tool === 'projscan_workspaces' && searchToolingConfigContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_workspaces' && !workspacesKeywordMatches(keyword, tokens))
    return false;
  if (entry.tool === 'projscan_upgrade' && keyword === 'update' && !hasPackageChange) return false;
  if (
    entry.tool === 'projscan_upgrade' &&
    keyword === 'package' &&
    packageImporterContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_upgrade' &&
    ['package', 'dependency', 'dependencies', 'npm'].includes(keyword) &&
    regressionLocalSetupContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_upgrade' &&
    ['remove', 'drop', 'uninstall'].includes(keyword) &&
    !hasPackageRemoval
  )
    return false;
  if (entry.tool === 'projscan_outdated' && keyword === 'npm' && !outdatedNpmContextMatches(tokens))
    return false;
  if (
    entry.tool === 'projscan_preflight' &&
    keyword === 'ready' &&
    !preflightReadyContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_preflight' &&
    ['risk', 'risks'].includes(keyword) &&
    !preflightRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_preflight' &&
    [
      'rebase',
      'rebasing',
      'conflict',
      'conflicts',
      'resolve',
      'resolving',
      'wrong',
      'stuck',
    ].includes(keyword) &&
    !preflightBranchRecoveryContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_hotspots' &&
    ['files', 'file', 'touch'].includes(keyword) &&
    !hotspotFileRiskContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_hotspots' &&
    [
      'performance',
      'perf',
      'bottleneck',
      'bottlenecks',
      'optimize',
      'optimise',
      'faster',
      'slow',
    ].includes(keyword) &&
    !hotspotPerformanceContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_coordinate' &&
    keyword === 'agent' &&
    !coordinateAgentContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_coordinate' &&
    ['who', 'else', 'working'].includes(keyword) &&
    !coordinateWorkingContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_coordinate' &&
    keyword === 'editing' &&
    !coordinateWorkingContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_coordinate' &&
    keyword === 'active' &&
    !coordinateActiveContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_coordinate' &&
    ['conflict', 'conflicts', 'conflicting', 'conflicted'].includes(keyword) &&
    !coordinateConflictContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_claim' && searchDataContractContextMatches(tokens)) return false;
  if (entry.tool === 'projscan_claim' && !claimKeywordMatches(keyword, tokens)) return false;
  if (
    entry.tool === 'projscan_collision' &&
    ['conflict', 'conflicts'].includes(keyword) &&
    !collisionConflictContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_collision' &&
    keyword === 'changes' &&
    !collisionChangeContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_merge_risk' && !mergeRiskKeywordMatches(keyword, tokens))
    return false;
  if (
    entry.tool === 'projscan_session' &&
    ['leave', 'left', 'off'].includes(keyword) &&
    !sessionLeaveOffContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_session' &&
    ['away', 'asleep', 'slept', 'offline'].includes(keyword) &&
    !sessionAwayContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_session' &&
    keyword === 'agent' &&
    !sessionAgentContextMatches(tokens)
  )
    return false;
  if (
    ['projscan_workplan', 'projscan_agent_brief'].includes(entry.tool) &&
    keyword === 'next' &&
    protectedImproveNextContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_workplan' && !workplanKeywordMatches(keyword, tokens)) return false;
  if (
    entry.tool === 'projscan_bug_hunt' &&
    keyword === 'first' &&
    ['merge', 'merged', 'merging'].some((token) => tokens.has(token))
  )
    return false;
  if (
    entry.tool === 'projscan_bug_hunt' &&
    ['fastest', 'quickest', 'quick', 'smallest'].includes(keyword) &&
    !bugHuntSpeedContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_bug_hunt' &&
    [
      'small',
      'low',
      'lowest',
      'improve',
      'improvement',
      'useful',
      'easy',
      'beginner',
      'starter',
      'intern',
      'interns',
      'task',
      'tasks',
      'five',
      'minutes',
      'today',
      'win',
      'wins',
    ].includes(keyword) &&
    !bugHuntOpportunityContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    !regressionKeywordMatches(keyword, tokens, hasQuotedText)
  )
    return false;
  if (entry.tool === 'projscan_release_train' && searchInfraArtifactContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_release_train' && !releaseTrainKeywordMatches(keyword, tokens))
    return false;
  return true;
}
