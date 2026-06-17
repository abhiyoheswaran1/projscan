/**
 * Intent router (4.x agent-ergonomics, epic 4).
 *
 * projscan exposes 40+ MCP tools. An agent shouldn't have to reason over all of
 * them every turn — it should be able to state a goal and get pointed at the one
 * right tool. `routeIntent` does exactly that: a deterministic, curated map from
 * common agent intents to the tool + exact call. No LLM (projscan never embeds
 * inference); ranking is keyword overlap against a hand-curated catalog.
 *
 * This is the additive, non-breaking half of the epic — a discovery entry point.
 * Actually shrinking the advertised tool surface (hiding the long tail behind
 * this router) is a breaking change reserved for 4.0.
 */

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
  proofCommandContextMatches,
  regressionBenchmarkContextMatches,
  regressionCiPlatformContextMatches,
  regressionFailureContextMatches,
  regressionFlakeContextMatches,
  regressionLocalSetupContextMatches,
  regressionPerformanceContextMatches,
  styleSystemFailureContextMatches,
  toolingFailureContextMatches,
} from './intentRouterRegressionSignals.js';
import {
  localServiceSetupCommandContextMatches,
  packageScriptDiscoveryContextMatches,
} from './intentRouterRepoSignals.js';
import {
  hasProhibitedReleaseWorkflowAction,
  hasProhibitedVersionBumpAction,
  prohibitedWorkflowKeywordMatches,
  releaseTrainKeywordMatches,
} from './intentRouterReleaseSignals.js';
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
  hasEnvVarTarget,
  hasFilePathTarget,
  hasPackageChangeTarget,
  hasPackageRemovalTarget,
  hasQuotedTextTarget,
} from './intentRouterTargetSignals.js';
import {
  coverageGapContextMatches,
  coverageKeywordMatches,
  searchCodeLocationContextMatches,
  searchTestLocationContextMatches,
  testCoverageLookupContextMatches,
  testRunContextMatches,
  verificationPlanningContextMatches,
} from './intentRouterVerificationSignals.js';
import {
  bugHuntOpportunityContextMatches,
  bugHuntSpeedContextMatches,
  protectedImproveNextContextMatches,
  workplanKeywordMatches,
} from './intentRouterWorkSignals.js';
import { keywordWeight } from './intentRouterKeywordWeights.js';
import { understandKeywordMatches } from './intentRouterUnderstandSignals.js';

export interface RouteEntry {
  /** Short intent label. */
  intent: string;
  category: string;
  tool: string;
  cli: string;
  /** What the tool does, one line. */
  what: string;
  /** When to reach for it. */
  why: string;
  /** A runnable example. */
  example: string;
  /** Terms that signal this intent. */
  keywords: string[];
}

export type RouteConfidence = 'high' | 'medium' | 'low';

export interface RouteMatch extends RouteEntry {
  score: number;
  rank: number;
  confidence: RouteConfidence;
  matchedKeywords: string[];
}

export interface RouteResult {
  intent: string | null;
  matched: boolean;
  matches: RouteMatch[];
}

export const ROUTE_CATALOG: RouteEntry[] = [
  {
    intent: 'Review local privacy and trust boundaries',
    category: 'Trust',
    tool: 'projscan_privacy_check',
    cli: 'projscan privacy-check',
    what: 'Local privacy, ignore, telemetry, plugin, write, and network boundary report.',
    why: 'Before trusting the tool on a repo, verify what it can read, write, or contact.',
    example: 'projscan privacy-check --offline',
    keywords: [
      'privacy',
      'trust',
      'boundary',
      'read',
      'env',
      'values',
      'upload',
      'code',
      'source',
      'leave',
      'machine',
      'telemetry',
      'network',
      'offline',
      'local',
      'contact',
      'contacted',
      'write',
      'writes',
      'check',
      'projscan',
    ],
  },
  {
    intent: 'Understand a repo before editing',
    category: 'Understand',
    tool: 'projscan_understand',
    cli: 'projscan understand',
    what: 'Cited repo/flow/contract/change/verify maps.',
    why: 'Orient in an unfamiliar codebase before making a change.',
    example: 'projscan understand --view map --format json',
    keywords: [
      'understand',
      'orient',
      'overview',
      'map',
      'read',
      'summarize',
      'summary',
      'contract',
      'contracts',
      'public',
      'api',
      'apis',
      'deprecate',
      'deprecates',
      'deprecated',
      'deprecation',
      'compatibility',
      'compatible',
      'comprehend',
      'unfamiliar',
      'learn',
      'explore',
      'architecture',
      'repo',
      'codebase',
      'service',
      'services',
      'main',
      'entrypoint',
      'entrypoints',
      'entry',
      'point',
      'important',
      'look',
      'first',
      'tour',
      'walk',
      'through',
      'new',
      'onboard',
      'onboarding',
      'run',
      'runs',
      'project',
      'command',
      'commands',
      'dev',
      'server',
      'start',
      'app',
      'setup',
      'set',
      'local',
      'locally',
      'install',
      'docker',
      'compose',
      'npm',
      'script',
      'scripts',
      'test',
      'tests',
      'e2e',
      'unit',
      'integration',
      'storybook',
      'cypress',
      'playwright',
      'eslint',
      'prettier',
      'format',
      'lint',
      'typecheck',
      'typechecking',
      'verify',
      'verification',
      'proof',
      'prove',
      'checks',
      'env',
      'environment',
      'environments',
      'vars',
      'variable',
      'variables',
      'missing',
      'required',
      'config',
      'configuration',
      'feature',
      'endpoint',
      'button',
      'put',
      'need',
      'change',
      'files',
      'add',
      'implement',
      'build',
      'create',
      'wire',
      'route',
      'component',
      'page',
      'screen',
      'view',
      'webhook',
      'login',
      'support',
      'checkout',
      'search',
      'doc',
      'docs',
      'document',
      'documentation',
      'readme',
      'examples',
      'example',
      'database',
      'migration',
      'migrations',
      'migrate',
      'migrates',
      'db',
      'schema',
      'table',
      'column',
      'seed',
      'seeds',
      'reset',
      'resets',
      'guide',
      'update',
      'updating',
    ],
  },
  {
    intent: 'Inspect a specific file',
    category: 'Understand',
    tool: 'projscan_file',
    cli: 'projscan file',
    what: 'Per-file purpose, imports, exports, smells, risk, ownership, and related issues.',
    why: 'When a developer asks what a named file does before editing it.',
    example: 'projscan file src/index.ts --format json',
    keywords: [
      'file',
      'explain',
      'inspect',
      'purpose',
      'read',
      'review',
      'reviewer',
      'reviewers',
      'ownership',
      'owner',
      'owns',
      'risk',
      'risks',
      'risky',
      'dangerous',
      'imports',
      'exports',
      'last',
      'touched',
      'touch',
      'changed',
      'recently',
      'history',
      'author',
      'authors',
      'blame',
      'add',
      'write',
      'coverage',
      'covered',
      'uncovered',
      'test',
      'tests',
    ],
  },
  {
    intent: 'Answer a targeted graph question',
    category: 'Understand',
    tool: 'projscan_semantic_graph',
    cli: 'projscan semantic-graph',
    what: 'Targeted imports, exports, importers, symbol definitions, or package importer query.',
    why: 'When a developer asks who imports a file, what a file imports/exports, or where a symbol is defined.',
    example: 'projscan semantic-graph --query importers --file src/auth.ts --format json',
    keywords: [
      'imports',
      'importers',
      'import',
      'exports',
      'export',
      'defined',
      'definition',
      'defines',
      'uses',
      'depend',
      'depends',
      'installed',
    ],
  },
  {
    intent: 'Inspect module coupling and cycles',
    category: 'Architecture',
    tool: 'projscan_coupling',
    cli: 'projscan coupling',
    what: 'Per-file fan-in, fan-out, instability, cross-package edges, and circular-import cycles.',
    why: 'When a developer asks about circular dependencies, import cycles, tight coupling, or unstable module boundaries.',
    example: 'projscan coupling --cycles-only --format json',
    keywords: [
      'coupling',
      'coupled',
      'tightly',
      'module',
      'modules',
      'circular',
      'cycle',
      'cycles',
      'dependency',
      'dependencies',
      'import',
      'imports',
      'fan',
      'fan-in',
      'fan-out',
      'instability',
      'architecture',
      'boundary',
      'boundaries',
    ],
  },
  {
    intent: 'Review a PR or a set of changes',
    category: 'Review',
    tool: 'projscan_review',
    cli: 'projscan review',
    what: 'One-call structural PR review with a verdict.',
    why: 'Assess risk of a diff: cycles, taint, dataflow, contracts.',
    example: 'projscan review --format json',
    keywords: [
      'review',
      'pr',
      'pull',
      'request',
      'branch',
      'diff',
      'change',
      'changes',
      'secure',
      'security',
      'issues',
      'check',
      'risk',
      'risks',
      'risky',
      'verdict',
      'assess',
    ],
  },
  {
    intent: 'Prepare reviewer evidence or a PR comment',
    category: 'Review',
    tool: 'projscan_evidence_pack',
    cli: 'projscan evidence-pack',
    what: 'Approval-ready evidence packet and paste-ready PR comment.',
    why: 'When a developer needs a reviewer-facing summary with verdict, risks, owner routing, and proof commands.',
    example: 'projscan evidence-pack --pr-comment',
    keywords: [
      'evidence',
      'proof',
      'approval',
      'approve',
      'comment',
      'summarize',
      'changes',
      'description',
      'draft',
      'say',
      'checklist',
      'tell',
      'team',
      'change',
      'share',
      'reviewer',
      'reviewers',
      'summary',
      'packet',
      'paste',
      'who',
      'review',
      'ready',
      'open',
      'opening',
      'before',
      'prepare',
      'owner',
      'owners',
      'owns',
      'routing',
      'changed',
      'file',
      'files',
      'pr',
    ],
  },
  {
    intent: 'Inspect what changed in a PR',
    category: 'Review',
    tool: 'projscan_pr_diff',
    cli: 'projscan pr-diff',
    what: 'Structural diff of changed exports, imports, call sites, complexity, and fan-in.',
    why: 'Before a full review verdict, see exactly what changed in the PR.',
    example: 'projscan pr-diff --format json',
    keywords: [
      'commit',
      'message',
      'summarize',
      'summary',
      'pr',
      'diff',
      'changed',
      'changes',
      'change',
      'since',
      'branch',
      'stale',
      'main',
      'base',
      'head',
      'compare',
      'branched',
      'behind',
      'ahead',
      'sync',
      'synced',
      'large',
      'big',
      'size',
      'sizes',
      'exports',
      'imports',
      'calls',
      'callers',
    ],
  },
  {
    intent: 'See what breaks if I change something',
    category: 'Impact',
    tool: 'projscan_impact',
    cli: 'projscan impact',
    what: 'Transitive blast radius for a file or symbol.',
    why: 'Before renaming or deleting, see every caller that breaks.',
    example: 'projscan impact --symbol buildCodeGraph --format json',
    keywords: [
      'impact',
      'breaks',
      'break',
      'blast',
      'radius',
      'rename',
      'delete',
      'remove',
      'drop',
      'depends',
      'affect',
      'callers',
      'used',
      'usage',
      'referenced',
      'called',
      'breaking',
      'api',
      'apis',
      'endpoint',
      'endpoints',
      'client',
      'clients',
      'contract',
      'contracts',
      'change',
      'changes',
      'changing',
      'deprecate',
      'deprecates',
      'deprecated',
      'deprecation',
      'compatibility',
      'compatible',
      'version',
      'versions',
      'schema',
      'table',
      'column',
      'database',
      'db',
      'migration',
      'migrations',
      'revert',
      'rollback',
      'undo',
      'backout',
      'back',
      'out',
      'recover',
    ],
  },
  {
    intent: 'Check if it is safe to edit / commit / merge',
    category: 'Safety gate',
    tool: 'projscan_preflight',
    cli: 'projscan preflight',
    what: 'proceed / caution / block verdict with evidence.',
    why: 'A safety gate before an edit, commit, or merge.',
    example: 'projscan preflight --mode before_commit --format json',
    keywords: [
      'safe',
      'safety',
      'gate',
      'commit',
      'merge',
      'ready',
      'edit',
      'proceed',
      'block',
      'blocked',
      'blocker',
      'blockers',
      'blocking',
      'preflight',
      'allowed',
      'risk',
      'risks',
      'risky',
      'rebase',
      'rebasing',
      'conflict',
      'conflicts',
      'resolve',
      'resolving',
      'wrong',
      'stuck',
    ],
  },
  {
    intent: 'Find the riskiest files / where to start',
    category: 'Hotspots',
    tool: 'projscan_hotspots',
    cli: 'projscan hotspots',
    what: 'Files ranked by churn × complexity × issues.',
    why: 'Decide where to focus review or refactoring.',
    example: 'projscan hotspots --format json',
    keywords: [
      'hotspot',
      'risky',
      'files',
      'file',
      'touch',
      'riskiest',
      'where',
      'start',
      'focus',
      'churn',
      'complexity',
      'complex',
      'refactor',
      'refactoring',
      'simplify',
      'simplification',
      'tech',
      'debt',
      'duplicate',
      'duplicated',
      'duplication',
      'over',
      'engineered',
      'dangerous',
      'performance',
      'perf',
      'bottleneck',
      'bottlenecks',
      'optimize',
      'optimise',
      'faster',
      'slow',
    ],
  },
  {
    intent: 'Check swarm coordination status',
    category: 'Swarm coordination',
    tool: 'projscan_coordinate',
    cli: 'projscan coordinate',
    what: 'One-call readiness verdict from collisions, claims, and merge-risk.',
    why: 'Before continuing parallel work, see whether the swarm is clear, cautious, or conflicted.',
    example: 'projscan coordinate --format json',
    keywords: [
      'who',
      'else',
      'working',
      'editing',
      'coordinate',
      'coordination',
      'status',
      'readiness',
      'parallel',
      'agents',
      'agent',
      'collide',
      'colliding',
      'swarm',
      'conflict',
      'conflicts',
      'conflicting',
      'conflicted',
      'worktree',
      'worktrees',
      'active',
      'overlap',
    ],
  },
  {
    intent: 'Detect conflicts between parallel agents',
    category: 'Swarm coordination',
    tool: 'projscan_collision',
    cli: 'projscan collisions',
    what: 'Same-file + dependency overlaps across worktrees.',
    why: 'Two agents editing one repo: surface collisions pre-merge.',
    example: 'projscan collisions --format json',
    keywords: [
      'coordinate',
      'coordination',
      'parallel',
      'agents',
      'swarm',
      'conflict',
      'conflicts',
      'collision',
      'collide',
      'colliding',
      'worktree',
      'worktrees',
      'overlap',
      'overlapping',
      'changes',
      'simultaneous',
      'avoid',
    ],
  },
  {
    intent: 'Claim a file so other agents know who owns it',
    category: 'Swarm coordination',
    tool: 'projscan_claim',
    cli: 'projscan claim',
    what: 'Advisory claims/leases over files, dirs, symbols.',
    why: 'Tell the swarm who is working where; warn on contention.',
    example: 'projscan claim add src/auth.ts --agent me',
    keywords: [
      'claim',
      'claims',
      'lease',
      'leases',
      'active',
      'owns',
      'ownership',
      'who',
      'reserve',
      'lock',
      'coordinate',
      'parallel',
      'agents',
      'swarm',
    ],
  },
  {
    intent: 'Decide the order to merge in-flight branches',
    category: 'Swarm coordination',
    tool: 'projscan_merge_risk',
    cli: 'projscan merge-risk',
    what: 'Safe integration order + conflict hotspots.',
    why: 'Multiple in-flight worktrees: which to merge first.',
    example: 'projscan merge-risk --format json',
    keywords: [
      'merge',
      'integrate',
      'integration',
      'order',
      'sequence',
      'first',
      'branch',
      'safest',
      'conflict',
      'hotspot',
      'coordinate',
      'parallel',
      'swarm',
    ],
  },
  {
    intent: 'Run a project health check',
    category: 'Health',
    tool: 'projscan_doctor',
    cli: 'projscan doctor',
    what: 'Health score + detected issues.',
    why: 'A quick overall health read on a repo.',
    example: 'projscan doctor --format json',
    keywords: [
      'health',
      'doctor',
      'score',
      'issues',
      'check',
      'quality',
      'lint',
      'dead',
      'unused',
      'orphaned',
      'cleanup',
      'clean',
      'safe',
      'safely',
      'delete',
      'remove',
    ],
  },
  {
    intent: 'See the quality and risk picture',
    category: 'Health',
    tool: 'projscan_quality_scorecard',
    cli: 'projscan quality-scorecard',
    what: 'Dimensioned quality view with health, security, tests, maintainability, coordination, and top risks.',
    why: 'When a developer asks what is risky or wants the overall quality picture before choosing the next task.',
    example: 'projscan quality-scorecard --format json',
    keywords: ['quality', 'scorecard', 'risk', 'risks', 'risky', 'picture', 'dimensions'],
  },
  {
    intent: 'Search the codebase',
    category: 'Search',
    tool: 'projscan_search',
    cli: 'projscan search',
    what: 'Symbol / file / content search (BM25 + optional semantic).',
    why: 'Find where something is defined or used.',
    example: 'projscan search "auth token" --format json',
    keywords: [
      'search',
      'find',
      'locate',
      'where',
      'show',
      'check',
      'checked',
      'test',
      'tests',
      'spec',
      'specs',
      'cover',
      'covers',
      'covering',
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
      'api',
      'apis',
      'route',
      'routes',
      'router',
      'routers',
      'endpoint',
      'endpoints',
      'webhook',
      'webhooks',
      'openapi',
      'swagger',
      'trpc',
      'grpc',
      'protobuf',
      'proto',
      'protos',
      'resolver',
      'resolvers',
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
      'billing',
      'settings',
      'checkout',
      'welcome',
      'template',
      'templates',
      'copy',
      'push',
      'sms',
      'verification',
      'receipt',
      'invoice',
      'invoices',
      'pdf',
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
      'fetches',
      'fetched',
      'axios',
      'external',
      'service',
      'services',
      'upload',
      'uploads',
      'uploaded',
      'sent',
      'form',
      'forms',
      'submit',
      'submits',
      'submitted',
      'loading',
      'state',
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
      'segment',
      'segments',
      'not',
      'found',
      '404',
      'i18n',
      'translation',
      'translations',
      'aria',
      'label',
      'button',
      'buttons',
      'focus',
      'trap',
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
      'feature',
      'features',
      'flag',
      'flags',
      'env',
      'var',
      'vars',
      'variable',
      'variables',
      'process',
      'processes',
      'used',
      'controls',
      'control',
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
      'permission',
      'permissions',
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
      'config',
      'configuration',
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
      'alias',
      'aliases',
      'define',
      'defines',
      'migration',
      'migrations',
      'generated',
      'exist',
      'exists',
      'ran',
      'file',
      'files',
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
      'doc',
      'docs',
      'document',
      'documentation',
      'documented',
      'readme',
      'examples',
      'example',
      'guide',
      'grep',
      'lookup',
      'symbol',
    ],
  },
  {
    intent: 'Trace dataflow / find injection risk',
    category: 'Security',
    tool: 'projscan_dataflow',
    cli: 'projscan dataflow',
    what: 'Source-to-sink dataflow risks.',
    why: 'Spot request-data reaching dangerous sinks.',
    example: 'projscan dataflow --format json',
    keywords: [
      'dataflow',
      'taint',
      'security',
      'injection',
      'source',
      'sink',
      'sinks',
      'vulnerability',
      'sql',
      'xss',
      'secret',
      'secrets',
      'expose',
      'exposes',
      'exposed',
      'sanitize',
      'sanitized',
      'request',
      'data',
      'reach',
      'reaches',
      'exec',
      'auth',
      'bypass',
      'pii',
      'gdpr',
      'compliance',
      'personal',
      'customer',
      'email',
      'emails',
      'password',
      'token',
      'tokens',
      'leak',
      'leaks',
      'logged',
      'logging',
      'log',
      'logs',
      'store',
      'stores',
      'retention',
      'handled',
      'handles',
      'process',
      'processes',
      'processing',
    ],
  },
  {
    intent: 'Get a fix for an issue',
    category: 'Fix',
    tool: 'projscan_fix_suggest',
    cli: 'projscan fix-suggest',
    what: 'Structured action prompt for an open issue.',
    why: 'Turn a detected issue into a concrete fix plan.',
    example: 'projscan fix-suggest <issue-id> --format json',
    keywords: ['fix', 'suggest', 'resolve', 'repair', 'remediate', 'how', 'issue'],
  },
  {
    intent: 'Explain an issue before fixing it',
    category: 'Fix',
    tool: 'projscan_explain_issue',
    cli: 'projscan explain-issue',
    what: 'Deep issue context: excerpt, related issues, past fixes, and suggested action.',
    why: 'Before fixing an issue, understand the surrounding code and prior fix evidence.',
    example: 'projscan explain-issue <issue-id> --format json',
    keywords: ['explain', 'issue', 'context', 'why', 'details', 'surrounding'],
  },
  {
    intent: 'Orient on first use / set up projscan',
    category: 'Onboarding',
    tool: 'projscan_start',
    cli: 'projscan start',
    what: 'First-60-seconds orientation + next commands.',
    why: 'New to this repo or to projscan.',
    example: 'projscan start --format json',
    keywords: ['start', 'begin', 'setup', 'onboard', 'first', 'getting', 'started', 'new'],
  },
  {
    intent: 'Plan the next agent work',
    category: 'Agent planning',
    tool: 'projscan_workplan',
    cli: 'projscan workplan',
    what: 'Ordered agent execution plan with verification.',
    why: 'Turn evidence into prioritized, verifiable tasks.',
    example: 'projscan workplan --mode bug_hunt --format json',
    keywords: [
      'plan',
      'workplan',
      'tasks',
      'do',
      'next',
      'todo',
      'prioritize',
      'priorities',
      'roadmap',
      'build',
      'product',
      'products',
      'feature',
      'features',
      'strategy',
      'strategic',
    ],
  },
  {
    intent: 'Brief the next agent',
    category: 'Agent planning',
    tool: 'projscan_agent_brief',
    cli: 'projscan agent-brief',
    what: 'Compact next-agent context packet with focus items, guardrails, and suggested next actions.',
    why: 'When handing work to another agent or developer and they need enough context to resume quickly.',
    example: 'projscan agent-brief --intent next_agent --format json',
    keywords: ['brief', 'handoff', 'next', 'agent', 'context', 'resume', 'guardrails'],
  },
  {
    intent: 'Resume from session context',
    category: 'Agent planning',
    tool: 'projscan_session',
    cli: 'projscan session',
    what: 'Durable session summary, touched files, and event log.',
    why: 'When resuming work or checking what prior agents and tools touched before editing again.',
    example: 'projscan session touched --format json',
    keywords: [
      'session',
      'touched',
      'touch',
      'resume',
      'leave',
      'left',
      'off',
      'last',
      'agent',
      'previous',
      'changed',
      'asleep',
      'slept',
      'away',
      'offline',
      'events',
      'history',
    ],
  },
  {
    intent: 'Diagnose failing CI or tests',
    category: 'Regression',
    tool: 'projscan_regression_plan',
    cli: 'projscan regression-plan',
    what: 'Focused verification matrix for failing CI, tests, and regression signals.',
    why: 'When a PR or branch has failing CI/tests, choose the smallest proof loop before editing.',
    example: 'projscan regression-plan --level focused --format json',
    keywords: [
      'ci',
      'github',
      'action',
      'actions',
      'workflow',
      'workflows',
      'pipeline',
      'pipelines',
      'job',
      'jobs',
      'fail',
      'build',
      'builds',
      'failing',
      'lint',
      'typecheck',
      'typechecking',
      'install',
      'failed',
      'error',
      'errors',
      'failure',
      'failures',
      'debug',
      'stack',
      'trace',
      'production',
      'prod',
      'down',
      'outage',
      'triage',
      'incident',
      'runtime',
      'crash',
      'crashes',
      'crashing',
      'connection',
      'refused',
      'port',
      'ports',
      'eaddrinuse',
      'listen',
      'address',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
      'root',
      'cause',
      'returning',
      'returns',
      'log',
      'logs',
      '500',
      '502',
      '503',
      '504',
      '404',
      '403',
      '401',
      'smoke',
      'regression',
      'focused',
      'full',
      'verification',
      'verify',
      'checks',
      'proof',
      'prove',
      'commands',
      'command',
      'works',
      'push',
      'pushing',
      'run',
      'rerun',
      'test',
      'tests',
      'slow',
      'slower',
      'speed',
      'speedup',
      'faster',
      'benchmark',
      'benchmarks',
      'reproduce',
      'reproduces',
      'reproducing',
      'flake',
      'flaky',
      'flakes',
      'intermittent',
      'intermittently',
      'nondeterministic',
      'nondeterminism',
      'race',
      'condition',
      'stabilize',
      'stabilise',
      'quarantine',
      'pr',
    ],
  },
  {
    intent: 'Find the scariest untested files',
    category: 'Tests',
    tool: 'projscan_coverage',
    cli: 'projscan coverage',
    what: 'Coverage gaps joined with hotspot risk.',
    why: 'Pick the next file that most deserves regression coverage.',
    example: 'projscan coverage --format json',
    keywords: [
      'coverage',
      'scariest',
      'untested',
      'uncovered',
      'test',
      'tests',
      'file',
      'files',
      'no',
      'missing',
      'without',
      'gap',
      'gaps',
    ],
  },
  {
    intent: 'Prepare release readiness',
    category: 'Release',
    tool: 'projscan_release_train',
    cli: 'projscan release-train',
    what: 'Product-line release readiness evidence and next release actions.',
    why: 'Before tagging, deploying, publishing, or approving a release, collect readiness evidence and blockers.',
    example: 'projscan release-train --format json',
    keywords: [
      'release',
      'releasing',
      'deploy',
      'deploying',
      'deployed',
      'deployment',
      'ship',
      'shipping',
      'publish',
      'tag',
      'changelog',
      'sbom',
      'package',
      'readiness',
      'prepare',
      'check',
      'note',
      'notes',
      'draft',
      'entry',
      'summarize',
      'summary',
      'change',
      'changes',
      'changed',
      'since',
      'last',
    ],
  },
  {
    intent: 'Find bugs to fix',
    category: 'Agent planning',
    tool: 'projscan_bug_hunt',
    cli: 'projscan bug-hunt',
    what: 'Ranked action queue from doctor/preflight/hotspots.',
    why: 'Decide which bugs or sign-off actions to tackle first.',
    example: 'projscan bug-hunt --format json',
    keywords: [
      'bug',
      'bugs',
      'hunt',
      'queue',
      'defect',
      'broken',
      'first',
      'fastest',
      'quickest',
      'quick',
      'smallest',
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
      'find',
      'win',
      'wins',
      'fix',
      'pr',
    ],
  },
  {
    intent: 'Inventory declared dependencies',
    category: 'Dependencies',
    tool: 'projscan_dependencies',
    cli: 'projscan dependencies',
    what: 'Declared production/dev dependency counts, risks, and workspace breakdown.',
    why: 'When a developer asks what packages the repo uses before changing supply-chain or package code.',
    example: 'projscan dependencies --format json',
    keywords: [
      'dependencies',
      'dependency',
      'deps',
      'package',
      'packages',
      'inventory',
      'declared',
      'supply-chain',
      'bundle',
      'bundles',
      'size',
      'sizes',
      'large',
      'heavy',
      'bloat',
      'bloated',
      'weight',
      'footprint',
      'reduce',
      'slim',
      'license',
      'licenses',
      'gpl',
      'copyleft',
      'third',
      'party',
      'notice',
      'notices',
      'open',
      'source',
      'compliance',
    ],
  },
  {
    intent: 'Map monorepo workspaces',
    category: 'Dependencies',
    tool: 'projscan_workspaces',
    cli: 'projscan workspaces',
    what: 'Detected monorepo workspace packages with names, paths, and versions.',
    why: 'When a developer asks which workspace/package owns code or where package-scoped work should start.',
    example: 'projscan workspaces --format json',
    keywords: [
      'workspace',
      'workspaces',
      'monorepo',
      'package',
      'packages',
      'map',
      'list',
      'owns',
      'contains',
      'put',
      'change',
    ],
  },
  {
    intent: 'Preview package upgrade impact',
    category: 'Dependencies',
    tool: 'projscan_upgrade',
    cli: 'projscan upgrade',
    what: 'Offline upgrade impact: version drift, CHANGELOG breaking markers, and importers.',
    why: 'Before bumping a package, see who imports it and whether the local changelog signals breakage.',
    example: 'projscan upgrade chalk --format json',
    keywords: [
      'upgrade',
      'bump',
      'update',
      'remove',
      'drop',
      'uninstall',
      'package',
      'dependency',
      'dependencies',
      'version',
      'breaking',
    ],
  },
  {
    intent: 'Audit dependency vulnerabilities',
    category: 'Dependencies',
    tool: 'projscan_audit',
    cli: 'projscan audit',
    what: 'npm audit vulnerability summary with package-scoped findings.',
    why: 'When a developer asks about CVEs, vulnerable packages, or dependency security.',
    example: 'projscan audit --format json',
    keywords: [
      'audit',
      'cve',
      'cves',
      'vulnerable',
      'vulnerability',
      'vulnerabilities',
      'security',
      'secure',
      'safe',
      'dependency',
      'dependencies',
      'package',
      'packages',
      'npm',
    ],
  },
  {
    intent: 'Check dependency health / outdated / audit',
    category: 'Dependencies',
    tool: 'projscan_outdated',
    cli: 'projscan outdated',
    what: 'Outdated deps, audit, and upgrade preview.',
    why: 'Assess dependency freshness and vulnerabilities.',
    example: 'projscan outdated --format json',
    keywords: [
      'dependency',
      'dependencies',
      'outdated',
      'audit',
      'upgrade',
      'vulnerable',
      'package',
      'npm',
    ],
  },
];

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'i',
  'to',
  'my',
  'is',
  'it',
  'of',
  'in',
  'on',
  'and',
  'or',
  'for',
  'this',
  'that',
  'how',
  'what',
  'me',
  'we',
  'with',
  'can',
  'should',
  'if',
  'be',
  'am',
  'are',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Map a stated intent to the best-matching projscan tool(s). With no intent,
 * returns the full catalog grouped by category. Ranking is keyword overlap;
 * ties keep catalog order (deterministic).
 */
export function routeIntent(intent: string | undefined): RouteResult {
  if (!intent || intent.trim() === '') {
    const grouped = [...ROUTE_CATALOG].sort((a, b) => a.category.localeCompare(b.category));
    return {
      intent: null,
      matched: grouped.length > 0,
      matches: grouped.map((entry, index) => routeMatch(entry, index + 1, [])),
    };
  }

  const tokens = new Set(tokenize(intent));
  const hasFilePath = hasFilePathTarget(intent);
  const hasPackageRemoval = !hasFilePath && hasPackageRemovalTarget(intent);
  const hasPackageChange = !hasFilePath && hasPackageChangeTarget(intent);
  const hasEnvVar = hasEnvVarTarget(intent);
  const hasQuotedText = hasQuotedTextTarget(intent);
  const hasProhibitedReleaseAction = hasProhibitedReleaseWorkflowAction(intent);
  const hasProhibitedVersionBump = hasProhibitedVersionBumpAction(intent);
  const scored = ROUTE_CATALOG.map((entry, index) => {
    const matchedKeywords = entry.keywords
      .filter(
        (kw) =>
          !prohibitedWorkflowKeywordMatches(
            entry,
            kw,
            hasProhibitedReleaseAction,
            hasProhibitedVersionBump,
          ),
      )
      .filter((kw) =>
        routeKeywordMatches(
          entry,
          kw,
          tokens,
          hasFilePath,
          hasPackageRemoval,
          hasPackageChange,
          hasEnvVar,
          hasQuotedText,
        ),
      );
    return { entry, score: routeScore(entry, matchedKeywords), matchedKeywords, index };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return {
    intent,
    matched: scored.length > 0,
    matches: scored.map((s, index) => routeMatch(s.entry, index + 1, s.matchedKeywords)),
  };
}

function routeKeywordMatches(
  entry: RouteEntry,
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
    [
      'github',
      'action',
      'actions',
      'workflow',
      'workflows',
      'pipeline',
      'pipelines',
      'job',
      'jobs',
    ].includes(keyword) &&
    !regressionCiPlatformContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    searchQuotedDebugTextContextMatches(tokens, hasQuotedText)
  )
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchReliabilityContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchUiInteractionContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchIntegrationContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchApiContractContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchInfraArtifactContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchDomainWorkflowContextMatches(tokens))
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    searchCommunicationArtifactContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchStateManagementContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchDataAccessContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchNavigationLayoutContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchFrontendPageRouteContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && searchStyleSystemContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && verificationPlanningContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_regression_plan' && packageScriptDiscoveryContextMatches(tokens))
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    [
      'port',
      'ports',
      'eaddrinuse',
      'listen',
      'address',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
    ].includes(keyword) &&
    !regressionLocalSetupContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    [
      'build',
      'builds',
      'lint',
      'typecheck',
      'typechecking',
      'install',
      'debug',
      'stack',
      'trace',
      'error',
      'errors',
      'failure',
      'failures',
      'production',
      'prod',
      'down',
      'outage',
      'incident',
      'triage',
      'runtime',
      'crash',
      'crashes',
      'crashing',
      'connection',
      'refused',
      'root',
      'cause',
      'returning',
      'returns',
      'log',
      'logs',
      '500',
      '502',
      '503',
      '504',
      '404',
      '403',
      '401',
    ].includes(keyword) &&
    !regressionFailureContextMatches(tokens) &&
    !regressionPerformanceContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    ['test', 'tests'].includes(keyword) &&
    (testCoverageLookupContextMatches(tokens) || coverageGapContextMatches(tokens))
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    ['run', 'rerun'].includes(keyword) &&
    !testRunContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    ['commands', 'command', 'works'].includes(keyword) &&
    !proofCommandContextMatches(tokens) &&
    !regressionBenchmarkContextMatches(tokens) &&
    !regressionFlakeContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    ['slow', 'slower', 'speed', 'speedup', 'faster', 'benchmark', 'benchmarks'].includes(keyword) &&
    !regressionPerformanceContextMatches(tokens)
  )
    return false;
  if (
    entry.tool === 'projscan_regression_plan' &&
    [
      'reproduce',
      'reproduces',
      'reproducing',
      'flake',
      'flaky',
      'flakes',
      'intermittent',
      'intermittently',
      'nondeterministic',
      'nondeterminism',
      'race',
      'condition',
      'stabilize',
      'stabilise',
      'quarantine',
    ].includes(keyword) &&
    !regressionFlakeContextMatches(tokens)
  )
    return false;
  if (entry.tool === 'projscan_release_train' && searchInfraArtifactContextMatches(tokens))
    return false;
  if (entry.tool === 'projscan_release_train' && !releaseTrainKeywordMatches(keyword, tokens))
    return false;
  return true;
}

function routeMatch(entry: RouteEntry, rank: number, matchedKeywords: string[]): RouteMatch {
  const score = routeScore(entry, matchedKeywords);
  return {
    ...entry,
    score,
    rank,
    confidence: routeConfidence(score),
    matchedKeywords,
  };
}

function routeScore(entry: RouteEntry, matchedKeywords: string[]): number {
  return matchedKeywords.reduce((total, keyword) => total + keywordWeight(entry, keyword), 0);
}

function routeConfidence(score: number): RouteConfidence {
  if (score >= 2) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}
