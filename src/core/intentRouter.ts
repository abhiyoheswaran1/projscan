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

function hasProhibitedReleaseWorkflowAction(intent: string): boolean {
  return (
    /\bno[-\s]+(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
      intent,
    ) ||
    /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
      intent,
    ) ||
    /\bwithout\b[^.?!\n]*(?:release|releasing|publish|publishing|deploy|deploying|deployment|push|pushing|merge|merging|tag|tagging|ship|shipping)\b/i.test(
      intent,
    )
  );
}

function hasProhibitedVersionBumpAction(intent: string): boolean {
  return (
    /\bno[-\s]+(?:version[-\s]+)?(?:bump|cut)\b/i.test(intent) ||
    /\b(?:do\s+not|don't|dont|never)\b[^.?!\n]*(?:bump(?:ing)?(?:\s+the)?\s+version|version\s+bump|cut(?:ting)?(?:\s+a)?\s+version)\b/i.test(
      intent,
    ) ||
    /\bwithout\b[^.?!\n]*(?:bump(?:ing)?(?:\s+the)?\s+version|version\s+bump|cut(?:ting)?(?:\s+a)?\s+version)\b/i.test(
      intent,
    )
  );
}

function isReleaseWorkflowActionKeyword(keyword: string): boolean {
  return [
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
  ].includes(keyword);
}

function isVersionBumpActionKeyword(keyword: string): boolean {
  return ['bump', 'version'].includes(keyword);
}

function prohibitedWorkflowKeywordMatches(
  entry: RouteEntry,
  keyword: string,
  hasProhibitedReleaseAction: boolean,
  hasProhibitedVersionBump: boolean,
): boolean {
  return (
    (entry.tool === 'projscan_release_train' &&
      hasProhibitedReleaseAction &&
      isReleaseWorkflowActionKeyword(keyword)) ||
    (entry.tool === 'projscan_upgrade' &&
      hasProhibitedVersionBump &&
      isVersionBumpActionKeyword(keyword))
  );
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
    !searchOwnershipContextMatches(tokens, hasFilePath) &&
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

function evidencePackKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const reviewerRoutingContext = [
    'who',
    'owner',
    'owners',
    'routing',
    'reviewer',
    'reviewers',
  ].some((token) => tokens.has(token));
  const prReviewContext = [
    'pr',
    'pull',
    'request',
    'review',
    'reviewer',
    'reviewers',
    'comment',
  ].some((token) => tokens.has(token));
  const prNarrativeContext = ['pr', 'pull', 'request'].some((token) => tokens.has(token));
  const reviewerSummaryContext =
    (tokens.has('summarize') || tokens.has('summary')) &&
    tokens.has('changes') &&
    ['reviewer', 'reviewers', 'pr', 'pull', 'request'].some((token) => tokens.has(token));
  const teamNarrativeContext =
    ['tell', 'share', 'team'].some((token) => tokens.has(token)) &&
    ['change', 'changes', 'changed', 'pr', 'pull', 'request'].some((token) => tokens.has(token));
  const prReadinessContext =
    prReviewContext &&
    ['ready', 'open', 'opening', 'before', 'prepare'].some((token) => tokens.has(token));
  const changedFileOwnerContext =
    tokens.has('changed') &&
    (tokens.has('file') || tokens.has('files')) &&
    ['who', 'owner', 'owners', 'owns'].some((token) => tokens.has(token));
  if (['description', 'draft', 'say'].includes(keyword)) return prNarrativeContext;
  if (keyword === 'checklist') return prNarrativeContext;
  if (['tell', 'team', 'share', 'change'].includes(keyword)) return teamNarrativeContext;
  if (['summarize', 'changes'].includes(keyword))
    return reviewerSummaryContext || teamNarrativeContext;
  if (keyword === 'summary') return prReviewContext || reviewerSummaryContext;
  if (keyword === 'review') return reviewerRoutingContext || prReadinessContext;
  if (['ready', 'open', 'opening', 'before', 'prepare'].includes(keyword))
    return prReadinessContext;
  if (['changed', 'file', 'files'].includes(keyword)) return changedFileOwnerContext;
  if (['who', 'owner', 'owners', 'owns', 'routing'].includes(keyword)) {
    return (
      changedFileOwnerContext ||
      ['review', 'reviewer', 'reviewers', 'pr', 'pull', 'request', 'comment'].some((token) =>
        tokens.has(token),
      )
    );
  }
  return true;
}

function reviewKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const reviewContext = [
    'review',
    'pr',
    'pull',
    'request',
    'branch',
    'diff',
    'change',
    'changes',
  ].some((token) => tokens.has(token));
  if (['risk', 'risks', 'risky', 'branch'].includes(keyword)) return reviewContext;
  if (['secure', 'security'].includes(keyword)) return reviewContext || tokens.has('check');
  if (['issues', 'check'].includes(keyword)) return tokens.has('security') && reviewContext;
  if (keyword === 'change')
    return tokens.has('secure') || tokens.has('security') || tokens.has('review');
  return true;
}

function dataflowKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const inherent = [
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
  ];
  if (inherent.includes(keyword)) return true;
  const privacySubject = [
    'pii',
    'gdpr',
    'personal',
    'customer',
    'email',
    'emails',
    'password',
    'token',
    'tokens',
    'secret',
    'secrets',
    'data',
  ].some((token) => tokens.has(token));
  const privacyAction = [
    'leak',
    'leaks',
    'expose',
    'exposes',
    'exposed',
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
  ].some((token) => tokens.has(token));
  if (['pii', 'gdpr', 'personal', 'customer', 'email', 'emails'].includes(keyword)) return true;
  if (keyword === 'compliance') return privacySubject;
  if (
    [
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
    ].includes(keyword)
  ) {
    return privacySubject || privacyAction;
  }
  const flowContext = [
    'security',
    'secure',
    'vulnerable',
    'vulnerability',
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
    'risk',
    'risks',
    'xss',
    'sql',
    'sink',
    'sinks',
    'pii',
    'gdpr',
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
    'store',
    'stores',
    'retention',
    'handled',
    'handles',
    'process',
    'processes',
    'processing',
  ].some((token) => tokens.has(token));
  if (['auth'].includes(keyword))
    return (
      tokens.has('bypass') || tokens.has('security') || tokens.has('risk') || tokens.has('risks')
    );
  return flowContext;
}

function auditKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const auditSignal = [
    'audit',
    'cve',
    'cves',
    'vulnerable',
    'vulnerability',
    'vulnerabilities',
  ].some((token) => tokens.has(token));
  const dependencyContext = ['dependency', 'dependencies', 'package', 'packages', 'npm'].some(
    (token) => tokens.has(token),
  );
  const securityContext = ['security', 'secure', 'safe'].some((token) => tokens.has(token));
  if (['audit', 'cve', 'cves', 'vulnerable', 'vulnerability', 'vulnerabilities'].includes(keyword))
    return true;
  if (['security', 'secure', 'safe'].includes(keyword)) return auditSignal || dependencyContext;
  if (['dependency', 'dependencies', 'package', 'packages', 'npm'].includes(keyword)) {
    return auditSignal || securityContext || tokens.has('audit');
  }
  return false;
}

function packageImporterContextMatches(tokens: Set<string>): boolean {
  return (
    (tokens.has('import') || tokens.has('imports') || tokens.has('importers')) &&
    (tokens.has('package') || tokens.has('dependency')) &&
    ['who', 'which', 'what', 'files'].some((token) => tokens.has(token))
  );
}

function packageDependencyLookupContextMatches(tokens: Set<string>, hasFilePath: boolean): boolean {
  if (hasFilePath) return false;
  const lookupSignal = ['who', 'what', 'which', 'why'].some((token) => tokens.has(token));
  const dependencySignal = ['uses', 'depend', 'depends', 'installed'].some((token) =>
    tokens.has(token),
  );
  return lookupSignal && dependencySignal;
}

function outdatedNpmContextMatches(tokens: Set<string>): boolean {
  return [
    'dependency',
    'dependencies',
    'outdated',
    'audit',
    'upgrade',
    'vulnerable',
    'vulnerability',
    'vulnerabilities',
    'package',
    'packages',
  ].some((token) => tokens.has(token));
}

function workspacesKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const workspaceContext = ['workspace', 'workspaces', 'monorepo'].some((token) =>
    tokens.has(token),
  );
  const packageContext = ['package', 'packages'].some((token) => tokens.has(token));
  const mapContext = ['map', 'list', 'owns', 'contains', 'put', 'change'].some((token) =>
    tokens.has(token),
  );
  if (['workspace', 'workspaces', 'monorepo'].includes(keyword)) return true;
  if (['package', 'packages'].includes(keyword)) return workspaceContext || mapContext;
  if (['map', 'list', 'owns', 'contains', 'put', 'change'].includes(keyword))
    return workspaceContext || packageContext;
  return false;
}

function dependenciesKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (
    dependencyCycleContextMatches(tokens) &&
    ['dependency', 'dependencies', 'deps', 'package', 'packages'].includes(keyword)
  )
    return false;
  if (
    [
      'dependencies',
      'dependency',
      'deps',
      'packages',
      'inventory',
      'declared',
      'supply-chain',
    ].includes(keyword)
  )
    return true;
  const licenseContext = [
    'license',
    'licenses',
    'gpl',
    'copyleft',
    'notice',
    'notices',
    'third',
    'party',
    'open',
    'source',
    'compliance',
  ].some((token) => tokens.has(token));
  const bloatContext = dependencyBloatContextMatches(tokens);
  if (
    [
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
    ].includes(keyword)
  )
    return bloatContext;
  if (keyword === 'package') return licenseContext || bloatContext;
  if (!licenseContext) return false;
  if (keyword === 'source')
    return (
      tokens.has('open') ||
      tokens.has('compliance') ||
      tokens.has('license') ||
      tokens.has('licenses')
    );
  if (keyword === 'open') return tokens.has('source') || tokens.has('compliance');
  if (keyword === 'compliance') {
    return (
      (tokens.has('open') && tokens.has('source')) ||
      [
        'license',
        'licenses',
        'gpl',
        'copyleft',
        'notice',
        'notices',
        'third',
        'party',
        'dependency',
        'dependencies',
        'package',
        'packages',
      ].some((token) => tokens.has(token))
    );
  }
  if (['third', 'party'].includes(keyword))
    return (
      tokens.has('third') &&
      tokens.has('party') &&
      (tokens.has('notice') ||
        tokens.has('notices') ||
        tokens.has('license') ||
        tokens.has('licenses') ||
        tokens.has('compliance'))
    );
  return true;
}

function couplingKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const cycleSignal = ['circular', 'cycle', 'cycles'].some((token) => tokens.has(token));
  const couplingSignal = ['coupling', 'coupled', 'tightly', 'instability', 'fan'].some((token) =>
    tokens.has(token),
  );
  const architectureSubject = [
    'dependency',
    'dependencies',
    'import',
    'imports',
    'module',
    'modules',
    'architecture',
    'boundary',
    'boundaries',
  ].some((token) => tokens.has(token));
  if (['circular', 'cycle', 'cycles', 'coupling', 'coupled', 'instability'].includes(keyword))
    return true;
  if (keyword === 'tightly') return tokens.has('coupled');
  if (keyword === 'fan') return architectureSubject || tokens.has('out') || tokens.has('in');
  if (['dependency', 'dependencies', 'import', 'imports'].includes(keyword)) {
    return dependencyCycleContextMatches(tokens) || (couplingSignal && architectureSubject);
  }
  if (['module', 'modules', 'architecture', 'boundary', 'boundaries'].includes(keyword))
    return cycleSignal || couplingSignal;
  return cycleSignal || (couplingSignal && architectureSubject);
}

function dependencyCycleContextMatches(tokens: Set<string>): boolean {
  const cycleSignal = ['circular', 'cycle', 'cycles'].some((token) => tokens.has(token));
  const couplingSignal = ['coupling', 'coupled', 'tightly', 'instability', 'fan'].some((token) =>
    tokens.has(token),
  );
  const architectureSubject = [
    'dependency',
    'dependencies',
    'import',
    'imports',
    'module',
    'modules',
    'architecture',
    'boundary',
    'boundaries',
  ].some((token) => tokens.has(token));
  return architectureSubject && (cycleSignal || couplingSignal);
}

function dependencyBloatContextMatches(tokens: Set<string>): boolean {
  const bloatSignal = [
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
  ].some((token) => tokens.has(token));
  const packageSubject = [
    'dependency',
    'dependencies',
    'deps',
    'package',
    'packages',
    'bundle',
    'bundles',
    'app',
  ].some((token) => tokens.has(token));
  return bloatSignal && packageSubject;
}

function understandKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (
    [
      'api',
      'apis',
      'deprecate',
      'deprecates',
      'deprecated',
      'deprecation',
      'compatibility',
      'compatible',
    ].includes(keyword)
  ) {
    return true;
  }
  if (
    [
      'repo',
      'codebase',
      'service',
      'services',
      'architecture',
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
    ].includes(keyword)
  ) {
    if (keyword === 'repo' && (tokens.has('summarize') || tokens.has('summary'))) return false;
    return repoOrientationContextMatches(tokens);
  }
  if (
    ['run', 'runs', 'project', 'command', 'commands', 'dev', 'server', 'start', 'app'].includes(
      keyword,
    )
  ) {
    return (
      packageScriptDiscoveryContextMatches(tokens) ||
      verificationPlanningContextMatches(tokens) ||
      databaseSetupCommandContextMatches(tokens) ||
      localServiceSetupCommandContextMatches(tokens) ||
      repoRunContextMatches(tokens) ||
      repoOrientationContextMatches(tokens)
    );
  }
  if (['local', 'locally', 'docker', 'compose'].includes(keyword))
    return localServiceSetupCommandContextMatches(tokens) || repoSetupContextMatches(tokens);
  if (['npm', 'script', 'scripts'].includes(keyword)) {
    return npmScriptsContextMatches(tokens) || packageScriptDiscoveryContextMatches(tokens);
  }
  if (
    [
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
    ].includes(keyword)
  ) {
    return (
      packageScriptDiscoveryContextMatches(tokens) || verificationPlanningContextMatches(tokens)
    );
  }
  if (['verify', 'verification', 'proof', 'prove', 'checks'].includes(keyword)) {
    return verificationPlanningContextMatches(tokens);
  }
  if (['setup', 'set', 'locally', 'install'].includes(keyword)) {
    return repoSetupContextMatches(tokens);
  }
  if (
    [
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
    ].includes(keyword)
  ) {
    return repoConfigContextMatches(tokens);
  }
  if (['seed', 'seeds', 'reset', 'resets', 'migrate', 'migrates'].includes(keyword)) {
    return databaseSetupCommandContextMatches(tokens);
  }
  if (
    [
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
      'password',
      'reset',
      'invite',
      'onboarding',
      'refund',
      'subscription',
      'doc',
      'docs',
      'document',
      'documentation',
      'readme',
      'examples',
      'example',
      'migration',
      'migrations',
      'database',
      'db',
      'schema',
      'table',
      'column',
      'guide',
      'update',
      'updating',
    ].includes(keyword)
  ) {
    if (keyword === 'add' && tokens.has('where')) return false;
    if (
      [
        'doc',
        'docs',
        'document',
        'documentation',
        'readme',
        'examples',
        'example',
        'guide',
        'update',
        'updating',
      ].includes(keyword) &&
      !documentationPlanningContextMatches(tokens)
    )
      return false;
    if (
      ['migration', 'migrations', 'database', 'db'].includes(keyword) &&
      databaseSetupCommandContextMatches(tokens)
    )
      return true;
    if (
      ['migration', 'migrations', 'database', 'db', 'schema', 'table', 'column'].includes(
        keyword,
      ) &&
      !databaseChangePlanningContextMatches(tokens)
    )
      return false;
    if (keyword === 'change' && apiChangePlanningContextMatches(tokens)) return true;
    return featurePlacementContextMatches(tokens);
  }
  return true;
}

function privacyCheckKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const privacySubjectContext = [
    'privacy',
    'trust',
    'boundary',
    'upload',
    'leave',
    'machine',
    'telemetry',
    'network',
    'contact',
    'contacted',
    'projscan',
  ].some((token) => tokens.has(token));
  if (keyword === 'offline') return privacySubjectContext || tokens.has('mode');
  if (keyword === 'read') return privacySubjectContext;
  if (['env', 'values', 'code', 'source', 'local'].includes(keyword))
    return privacySubjectContext || (tokens.has('read') && tokens.has('projscan'));
  if (['write', 'writes'].includes(keyword)) return privacySubjectContext;
  if (keyword === 'check')
    return tokens.has('privacy') || tokens.has('trust') || tokens.has('boundary');
  if (keyword === 'projscan') {
    return [
      'read',
      'upload',
      'telemetry',
      'privacy',
      'write',
      'writes',
      'contact',
      'contacted',
    ].some((token) => tokens.has(token));
  }
  return true;
}

function repoRunContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  const runAction = ['run', 'start', 'command', 'dev', 'server'].some((token) => tokens.has(token));
  const repoSubject = ['project', 'repo', 'app', 'dev', 'server'].some((token) =>
    tokens.has(token),
  );
  return runAction && repoSubject;
}

function localServiceSetupCommandContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'broken',
      'connection',
      'refused',
      'port',
      'ports',
      'eaddrinuse',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  const action =
    ['run', 'runs', 'start', 'starts', 'command', 'commands', 'setup'].some((token) =>
      tokens.has(token),
    ) ||
    (tokens.has('set') && tokens.has('up'));
  const localSubject = tokens.has('local') || tokens.has('locally') || tokens.has('dev');
  const serviceSubject = ['service', 'services', 'server', 'app'].some((token) =>
    tokens.has(token),
  );
  const dockerComposeSubject = tokens.has('docker') && tokens.has('compose');
  return action && ((localSubject && serviceSubject) || dockerComposeSubject);
}

function databaseSetupCommandContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'broken',
      'connection',
      'refused',
      'port',
      'ports',
      'eaddrinuse',
      'permission',
      'denied',
      'enoent',
      'eresolve',
      'peer',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  if (['where', 'find', 'locate', 'search', 'lookup', 'defined'].some((token) => tokens.has(token)))
    return false;
  const databaseSubject = ['database', 'db', 'migration', 'migrations'].some((token) =>
    tokens.has(token),
  );
  const dataSubject =
    tokens.has('data') && (tokens.has('seed') || tokens.has('seeds') || tokens.has('load'));
  const setupAction = [
    'seed',
    'seeds',
    'reset',
    'resets',
    'migrate',
    'migrates',
    'run',
    'runs',
    'command',
    'load',
    'locally',
  ].some((token) => tokens.has(token));
  return (databaseSubject || dataSubject) && setupAction;
}

function npmScriptsContextMatches(tokens: Set<string>): boolean {
  const scriptSubject = tokens.has('script') || tokens.has('scripts');
  const lookupSignal = [
    'npm',
    'command',
    'commands',
    'run',
    'runs',
    'start',
    'exist',
    'exists',
    'list',
    'show',
  ].some((token) => tokens.has(token));
  return scriptSubject && lookupSignal;
}

function packageScriptDiscoveryContextMatches(tokens: Set<string>): boolean {
  const failureSignal = [
    'fail',
    'failing',
    'failed',
    'failure',
    'failures',
    'error',
    'errors',
    'broken',
    'debug',
    'flake',
    'flaky',
    'flakes',
    'slow',
    'slower',
    'rerun',
    'reproduce',
    'reproduces',
    'reproducing',
    'quarantine',
  ].some((token) => tokens.has(token));
  if (failureSignal) return false;

  const scriptSubject = ['script', 'scripts', 'command', 'commands'].some((token) =>
    tokens.has(token),
  );
  const runSignal = ['run', 'runs', 'start'].some((token) => tokens.has(token));
  const scriptTarget = [
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
    'build',
  ].some((token) => tokens.has(token));
  const directScriptTarget = [
    'e2e',
    'storybook',
    'cypress',
    'playwright',
    'eslint',
    'prettier',
    'format',
    'lint',
    'typecheck',
    'typechecking',
    'build',
  ].some((token) => tokens.has(token));
  if (
    (tokens.has('npm') || tokens.has('package')) &&
    (tokens.has('script') || tokens.has('scripts'))
  )
    return true;
  if (directScriptTarget && runSignal && !tokens.has('should')) return true;
  return scriptTarget && scriptSubject;
}

function repoSetupContextMatches(tokens: Set<string>): boolean {
  return (
    tokens.has('setup') ||
    tokens.has('locally') ||
    tokens.has('install') ||
    (tokens.has('set') && tokens.has('up'))
  );
}

function repoConfigContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('privacy') || tokens.has('trust') || tokens.has('boundary')) return false;
  if (
    tokens.has('projscan') &&
    ['read', 'upload', 'telemetry', 'write', 'writes'].some((token) => tokens.has(token))
  )
    return false;
  const envSubject = ['env', 'environment', 'environments', 'vars', 'variable', 'variables'].some(
    (token) => tokens.has(token),
  );
  return (
    tokens.has('vars') ||
    tokens.has('variables') ||
    tokens.has('variable') ||
    tokens.has('environment') ||
    tokens.has('environments') ||
    tokens.has('config') ||
    tokens.has('configuration') ||
    (envSubject &&
      ['missing', 'need', 'needed', 'required', 'requires', 'uses', 'repo', 'project', 'app'].some(
        (token) => tokens.has(token),
      ))
  );
}

function repoOrientationContextMatches(tokens: Set<string>): boolean {
  if (['bug', 'bugs', 'fix', 'issue', 'issues', 'test', 'tests'].some((token) => tokens.has(token)))
    return false;
  const orientationSubject =
    [
      'repo',
      'repository',
      'codebase',
      'service',
      'services',
      'architecture',
      'entrypoint',
      'entrypoints',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('entry') && tokens.has('point')) ||
    (tokens.has('important') && tokens.has('files'));
  const orientationAction = [
    'understand',
    'orient',
    'overview',
    'map',
    'read',
    'summarize',
    'summary',
    'new',
    'onboard',
    'onboarding',
    'start',
    'look',
    'first',
    'tour',
    'walk',
    'through',
    'main',
    'important',
    'where',
    'show',
    'give',
    'help',
    'explain',
  ].some((token) => tokens.has(token));
  if (tokens.has('look') && tokens.has('first')) return true;
  return orientationSubject && orientationAction;
}

function featurePlacementContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  if (documentationPlanningContextMatches(tokens)) return true;
  if (databaseChangePlanningContextMatches(tokens)) return true;
  if (apiChangePlanningContextMatches(tokens)) return true;
  if (stateManagementPlanningContextMatches(tokens)) return true;
  if (dataAccessPlanningContextMatches(tokens)) return true;
  if (navigationLayoutPlanningContextMatches(tokens)) return true;
  if (styleSystemPlanningContextMatches(tokens)) return true;
  const placementSubject = ['feature', 'endpoint', 'button'].some((token) => tokens.has(token));
  if (placementSubject && ['where', 'put', 'add'].some((token) => tokens.has(token))) return true;
  if (tokens.has('files') && tokens.has('need') && tokens.has('change')) return true;
  const kickoffAction = ['add', 'implement', 'build', 'create', 'wire'].some((token) =>
    tokens.has(token),
  );
  const kickoffSubject = [
    'feature',
    'endpoint',
    'button',
    'api',
    'apis',
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
    'password',
    'reset',
    'invite',
    'onboarding',
    'refund',
    'subscription',
  ].some((token) => tokens.has(token));
  return kickoffAction && kickoffSubject;
}

function domainWorkflowPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = [
    'add',
    'create',
    'implement',
    'build',
    'plan',
    'should',
    'todo',
    'next',
  ].some((token) => tokens.has(token));
  if (!planningAction) return false;
  return (
    (tokens.has('password') && tokens.has('reset')) ||
    tokens.has('invite') ||
    tokens.has('invites') ||
    tokens.has('onboarding') ||
    tokens.has('refund') ||
    (tokens.has('subscription') && tokens.has('renewal'))
  );
}

function stateManagementPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = [
    'add',
    'create',
    'implement',
    'build',
    'plan',
    'should',
    'todo',
    'next',
  ].some((token) => tokens.has(token));
  if (!planningAction) return false;
  return (
    [
      'redux',
      'zustand',
      'jotai',
      'recoil',
      'store',
      'stores',
      'slice',
      'slices',
      'selector',
      'selectors',
      'context',
      'provider',
      'providers',
      'hook',
      'hooks',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('react') && tokens.has('query'))
  );
}

function dataAccessPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = [
    'add',
    'create',
    'implement',
    'build',
    'plan',
    'should',
    'todo',
    'next',
  ].some((token) => tokens.has(token));
  if (!planningAction) return false;
  return (
    [
      'prisma',
      'drizzle',
      'typeorm',
      'sequelize',
      'model',
      'models',
      'entity',
      'entities',
      'repository',
      'repositories',
      'dao',
      'daos',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('sql') && (tokens.has('query') || tokens.has('queries')))
  );
}

function navigationLayoutPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some(
    (token) => tokens.has(token),
  );
  if (!planningAction) return false;
  return (
    [
      'sidebar',
      'nav',
      'navigation',
      'menu',
      'breadcrumb',
      'breadcrumbs',
      'layout',
      'title',
      'metadata',
    ].some((token) => tokens.has(token)) ||
    (tokens.has('next') && tokens.has('js'))
  );
}

function styleSystemPlanningContextMatches(tokens: Set<string>): boolean {
  const planningAction = ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some(
    (token) => tokens.has(token),
  );
  if (!planningAction) return false;
  return (
    (tokens.has('design') && (tokens.has('token') || tokens.has('tokens'))) ||
    tokens.has('tailwind') ||
    tokens.has('css') ||
    (tokens.has('dark') && tokens.has('mode')) ||
    tokens.has('breakpoint') ||
    tokens.has('breakpoints') ||
    tokens.has('theme') ||
    tokens.has('themes') ||
    tokens.has('style') ||
    tokens.has('styles')
  );
}

function documentationPlanningContextMatches(tokens: Set<string>): boolean {
  if (['find', 'where', 'locate', 'search', 'lookup'].some((token) => tokens.has(token)))
    return false;
  const docsSubject = [
    'doc',
    'docs',
    'document',
    'documentation',
    'readme',
    'examples',
    'example',
    'migration',
    'guide',
  ].some((token) => tokens.has(token));
  if (!docsSubject) return false;
  return [
    'change',
    'changes',
    'update',
    'updating',
    'need',
    'needs',
    'write',
    'generate',
    'feature',
    'api',
    'apis',
  ].some((token) => tokens.has(token));
}

function databaseChangePlanningContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  if (
    [
      'impact',
      'breaks',
      'break',
      'blast',
      'radius',
      'affect',
      'used',
      'usage',
      'referenced',
      'called',
      'drop',
      'delete',
      'remove',
      'rollback',
      'revert',
    ].some((token) => tokens.has(token))
  )
    return false;
  const databaseSubject = [
    'migration',
    'migrations',
    'database',
    'db',
    'schema',
    'table',
    'column',
  ].some((token) => tokens.has(token));
  if (!databaseSubject) return false;
  return [
    'where',
    'put',
    'add',
    'change',
    'need',
    'needs',
    'plan',
    'deploy',
    'zero',
    'downtime',
  ].some((token) => tokens.has(token));
}

function apiChangePlanningContextMatches(tokens: Set<string>): boolean {
  const apiSubject = [
    'api',
    'apis',
    'endpoint',
    'endpoints',
    'contract',
    'contracts',
    'public',
    'client',
    'clients',
  ].some((token) => tokens.has(token));
  if (!apiSubject) return false;
  return [
    'change',
    'changes',
    'changing',
    'deprecate',
    'deprecates',
    'deprecated',
    'deprecation',
    'break',
    'breaks',
    'breaking',
    'compatibility',
    'compatible',
    'version',
    'versions',
  ].some((token) => tokens.has(token));
}

function verificationPlanningContextMatches(tokens: Set<string>): boolean {
  if (
    ['smoke', 'focused', 'full', 'regression'].some((token) => tokens.has(token)) ||
    regressionFailureContextMatches(tokens) ||
    regressionPerformanceContextMatches(tokens) ||
    regressionFlakeContextMatches(tokens) ||
    testCoverageLookupContextMatches(tokens) ||
    coverageGapContextMatches(tokens) ||
    packageScriptDiscoveryContextMatches(tokens)
  ) {
    return false;
  }
  const testSubject = [
    'test',
    'tests',
    'spec',
    'specs',
    'e2e',
    'unit',
    'integration',
    'lint',
    'typecheck',
    'typechecking',
    'build',
  ].some((token) => tokens.has(token));
  const proofSignal = ['verify', 'verification', 'proof', 'prove', 'checks'].some((token) =>
    tokens.has(token),
  );
  const runSignal = ['run', 'rerun', 'execute'].some((token) => tokens.has(token));
  const gateSignal = [
    'before',
    'push',
    'pushing',
    'commit',
    'committing',
    'review',
    'merge',
    'pr',
  ].some((token) => tokens.has(token));
  const shouldSignal = ['should', 'need', 'needs', 'must'].some((token) => tokens.has(token));
  const querySignal = ['which', 'what'].some((token) => tokens.has(token));
  const changeSignal = ['change', 'changes', 'diff', 'branch'].some((token) => tokens.has(token));
  return (
    (testSubject &&
      (shouldSignal ||
        gateSignal ||
        proofSignal ||
        (runSignal && (querySignal || changeSignal)))) ||
    (proofSignal && (runSignal || gateSignal || testSubject))
  );
}

function searchTestLocationContextMatches(tokens: Set<string>, hasFilePath: boolean): boolean {
  if (testCoverageLookupContextMatches(tokens)) return true;
  if (!['where', 'find', 'locate', 'search', 'lookup'].some((token) => tokens.has(token)))
    return false;
  if (
    [
      'run',
      'rerun',
      'write',
      'add',
      'generate',
      'plan',
      'case',
      'cases',
      'cover',
      'coverage',
      'edge',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  return hasFilePath || ['test', 'tests', 'spec', 'specs'].some((token) => tokens.has(token));
}

function testCoverageLookupContextMatches(tokens: Set<string>): boolean {
  if (
    ['run', 'rerun', 'write', 'add', 'generate', 'plan', 'case', 'cases', 'edge', 'should'].some(
      (token) => tokens.has(token),
    )
  )
    return false;
  const testSubject = ['test', 'tests', 'spec', 'specs'].some((token) => tokens.has(token));
  const coverSignal = ['cover', 'covers', 'covering'].some((token) => tokens.has(token));
  const lookupSignal = ['which', 'what', 'where', 'find', 'locate', 'search', 'lookup'].some(
    (token) => tokens.has(token),
  );
  return testSubject && coverSignal && (lookupSignal || tokens.size >= 3);
}

function coverageKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (['coverage', 'scariest', 'untested', 'uncovered', 'gap', 'gaps'].includes(keyword))
    return true;
  if (['test', 'tests'].includes(keyword)) return coverageGapContextMatches(tokens);
  if (['file', 'files', 'no', 'missing', 'without'].includes(keyword))
    return missingTestCoverageContextMatches(tokens);
  return false;
}

function coverageGapContextMatches(tokens: Set<string>): boolean {
  if (
    ['coverage', 'scariest', 'untested', 'uncovered', 'gap', 'gaps'].some((token) =>
      tokens.has(token),
    )
  )
    return true;
  return missingTestCoverageContextMatches(tokens);
}

function missingTestCoverageContextMatches(tokens: Set<string>): boolean {
  const testSubject = tokens.has('test') || tokens.has('tests');
  const fileSubject = tokens.has('file') || tokens.has('files');
  const missingSignal = ['no', 'missing', 'without'].some((token) => tokens.has(token));
  return testSubject && (fileSubject || tokens.has('code')) && missingSignal;
}

function searchCodeLocationContextMatches(tokens: Set<string>): boolean {
  if (['run', 'rerun', 'test', 'tests', 'spec', 'specs'].some((token) => tokens.has(token)))
    return false;
  const locator = ['where', 'find', 'locate', 'search', 'lookup', 'which'].some((token) =>
    tokens.has(token),
  );
  const codeSubject = ['code', 'file', 'files', 'logic', 'handler', 'middleware', 'loader'].some(
    (token) => tokens.has(token),
  );
  const codeAction = [
    'handles',
    'handled',
    'contains',
    'implemented',
    'configured',
    'created',
    'loaded',
    'parse',
    'parses',
  ].some((token) => tokens.has(token));
  return locator || (codeSubject && codeAction);
}

function searchRouteHandlerContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'should',
      'add',
      'put',
      'new',
      'need',
      'needs',
      'change',
      'implement',
      'build',
      'create',
      'wire',
    ].some((token) => tokens.has(token))
  )
    return false;
  const routeSubject = [
    'api',
    'apis',
    'route',
    'routes',
    'endpoint',
    'endpoints',
    'login',
    'checkout',
    'webhook',
  ].some((token) => tokens.has(token));
  if (!routeSubject) return false;
  const handlerSignal = ['handler', 'handles', 'handled', 'implemented', 'defined'].some((token) =>
    tokens.has(token),
  );
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  return (
    handlerSignal ||
    (locator &&
      (tokens.has('handler') ||
        tokens.has('route') ||
        tokens.has('endpoint') ||
        tokens.has('endpoints')))
  );
}

function searchFeatureFlagContextMatches(tokens: Set<string>): boolean {
  const flagSubject =
    tokens.has('flag') || tokens.has('flags') || (tokens.has('feature') && tokens.has('flags'));
  if (!flagSubject) return false;
  return [
    'where',
    'which',
    'find',
    'locate',
    'search',
    'lookup',
    'exist',
    'exists',
    'configured',
    'loaded',
  ].some((token) => tokens.has(token));
}

function searchEnvLookupContextMatches(tokens: Set<string>, hasEnvVar: boolean): boolean {
  if (hasEnvVar) {
    return ['where', 'find', 'locate', 'search', 'lookup', 'used', 'referenced', 'process'].some(
      (token) => tokens.has(token),
    );
  }
  const envSubject = ['env', 'environment', 'var', 'vars', 'variable', 'variables'].some((token) =>
    tokens.has(token),
  );
  if (!envSubject) return false;
  if (
    [
      'need',
      'needs',
      'required',
      'requires',
      'missing',
      'contract',
      'contracts',
      'repo',
      'project',
    ].some((token) => tokens.has(token))
  )
    return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'controls',
    'control',
    'used',
    'uses',
  ].some((token) => tokens.has(token));
}

function searchQuotedDebugTextContextMatches(tokens: Set<string>, hasQuotedText: boolean): boolean {
  if (!hasQuotedText) return false;
  const debugSubject = [
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
  ].some((token) => tokens.has(token));
  const locator = ['where', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  return debugSubject || locator;
}

function searchBackgroundWorkContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'add',
      'create',
      'implement',
      'build',
      'put',
      'new',
      'change',
      'plan',
      'should',
      'todo',
      'next',
      'do',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  const explicitSubject = [
    'background',
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
  ].some((token) => tokens.has(token));
  const jobSubject =
    (tokens.has('job') || tokens.has('jobs')) &&
    ['background', 'cron', 'scheduled', 'schedule'].some((token) => tokens.has(token));
  const taskSubject =
    (tokens.has('task') || tokens.has('tasks')) &&
    ['scheduled', 'schedule'].some((token) => tokens.has(token));
  if (!explicitSubject && !jobSubject && !taskSubject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'exist',
      'exists',
      'defined',
      'handles',
      'handled',
      'process',
      'processes',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}

function searchObservabilityContextMatches(tokens: Set<string>): boolean {
  if (['privacy', 'trust', 'upload', 'projscan'].some((token) => tokens.has(token))) return false;
  const observabilitySubject = [
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
  ].some((token) => tokens.has(token));
  const logSubject =
    (tokens.has('log') || tokens.has('logs')) &&
    ['check', 'where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
      tokens.has(token),
    );
  if (!observabilitySubject && !logSubject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'check',
      'configured',
      'initialize',
      'initialise',
      'init',
      'emit',
      'emits',
      'emitted',
      'send',
      'sends',
      'handled',
      'code',
    ].some((token) => tokens.has(token)) || tokens.size >= 2
  );
}

function searchTestDataContextMatches(tokens: Set<string>): boolean {
  if (packageScriptDiscoveryContextMatches(tokens)) return false;
  if (databaseSetupCommandContextMatches(tokens)) return false;
  if (
    ['add', 'write', 'create', 'generate', 'plan', 'should', 'next', 'todo'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const seedSubject =
    tokens.has('seed') ||
    tokens.has('seeds') ||
    ((tokens.has('data') || tokens.has('database')) && (tokens.has('seed') || tokens.has('seeds')));
  const fixtureSubject = tokens.has('fixture') || tokens.has('fixtures');
  const mockSubject = tokens.has('mock') || tokens.has('mocks');
  const factorySubject = tokens.has('factory') || tokens.has('factories');
  const storySubject = tokens.has('storybook') || tokens.has('story') || tokens.has('stories');
  if (!seedSubject && !fixtureSubject && !mockSubject && !factorySubject && !storySubject)
    return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'used',
      'defined',
      'configured',
      'for',
      'render',
      'renders',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}

function searchAuthorizationContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'returning',
      'returns',
      'runtime',
      'incident',
      'crash',
      'crashes',
      'crashing',
      'outage',
      'denied',
      '500',
      '502',
      '503',
      '504',
      '404',
      '403',
      '401',
    ].some((token) => tokens.has(token))
  )
    return false;
  const subject = [
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
    'login',
  ].some((token) => tokens.has(token));
  if (!subject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'checked',
      'configured',
      'defined',
      'require',
      'requires',
      'required',
      'access',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}

function searchReliabilityContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const rateLimitSubject =
    ((tokens.has('rate') || tokens.has('rates')) &&
      (tokens.has('limit') || tokens.has('limits') || tokens.has('limiting'))) ||
    tokens.has('throttle') ||
    tokens.has('throttling');
  const cacheSubject = [
    'cache',
    'caches',
    'cached',
    'redis',
    'invalidate',
    'invalidates',
    'invalidated',
    'invalidation',
  ].some((token) => tokens.has(token));
  const retrySubject = ['retry', 'retries', 'retried', 'backoff'].some((token) =>
    tokens.has(token),
  );
  const timeoutSubject = tokens.has('timeout') || tokens.has('timeouts');
  const circuitSubject = tokens.has('circuit') && tokens.has('breaker');
  const idempotencySubject = tokens.has('idempotency') || tokens.has('idempotent');
  const signatureSubject =
    (tokens.has('signature') || tokens.has('signatures')) &&
    (tokens.has('webhook') ||
      tokens.has('verified') ||
      tokens.has('verify') ||
      tokens.has('verification'));
  const debounceSubject = tokens.has('debounce') || tokens.has('debounced');
  const subject =
    rateLimitSubject ||
    cacheSubject ||
    retrySubject ||
    timeoutSubject ||
    circuitSubject ||
    idempotencySubject ||
    signatureSubject ||
    debounceSubject;
  if (!subject) return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'code',
    'logic',
    'configured',
    'defined',
    'handled',
    'handling',
    'used',
    'set',
    'sets',
    'protect',
    'protects',
    'invalidate',
    'invalidates',
    'invalidated',
    'retry',
    'retries',
    'verified',
    'verify',
  ].some((token) => tokens.has(token));
}

function searchDataContractContextMatches(tokens: Set<string>): boolean {
  if (packageScriptDiscoveryContextMatches(tokens)) return false;
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const validationSubject =
    ['validation', 'validate', 'validates', 'validator', 'schema', 'schemas', 'zod'].some((token) =>
      tokens.has(token),
    ) ||
    (tokens.has('input') &&
      ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
        tokens.has(token),
      ));
  const parsingSubject =
    ['params', 'param'].some((token) => tokens.has(token)) &&
    ['request', 'query', 'parse', 'parses', 'parsed'].some((token) => tokens.has(token));
  const serializationSubject =
    ['json', 'serialize', 'serializes', 'serialization', 'response'].some((token) =>
      tokens.has(token),
    ) ||
    (['date', 'format', 'formats', 'formatting'].some((token) => tokens.has(token)) &&
      ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'defined'].some((token) =>
        tokens.has(token),
      ));
  const transactionSubject = tokens.has('transaction') || tokens.has('transactions');
  const lockingSubject =
    ['lock', 'locks', 'locking', 'optimistic'].some((token) => tokens.has(token)) &&
    ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'row', 'order', 'logic'].some(
      (token) => tokens.has(token),
    );
  const uniquenessSubject = ['unique', 'uniqueness', 'enforced'].some((token) => tokens.has(token));
  const paginationSubject = ['pagination', 'cursor', 'cursors'].some((token) => tokens.has(token));
  const subject =
    validationSubject ||
    parsingSubject ||
    serializationSubject ||
    transactionSubject ||
    lockingSubject ||
    uniquenessSubject ||
    paginationSubject;
  if (!subject) return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'input',
    'validates',
    'validation',
    'parsed',
    'parses',
    'serializes',
    'handled',
    'defined',
    'started',
    'wrap',
    'wraps',
    'lock',
    'locking',
    'enforced',
    'builds',
  ].some((token) => tokens.has(token));
}

function searchDataAccessContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'sink',
      'sinks',
      'source',
      'taint',
      'injection',
      'xss',
      'vulnerability',
      'security',
      'sanitize',
      'sanitized',
      'reach',
      'reaches',
    ].some((token) => tokens.has(token))
  )
    return false;
  if (tokens.has('drop') || tokens.has('delete') || tokens.has('remove')) return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const orm = ['prisma', 'drizzle', 'typeorm', 'sequelize'].some((token) => tokens.has(token));
  const ormArtifact = ['model', 'models', 'schema', 'schemas', 'entity', 'entities'].some((token) =>
    tokens.has(token),
  );
  const sqlSubject = tokens.has('sql') && (tokens.has('query') || tokens.has('queries'));
  const repositorySubject =
    ['repository', 'repositories', 'dao', 'daos'].some((token) => tokens.has(token)) &&
    [
      'saves',
      'save',
      'persist',
      'persists',
      'orders',
      'payments',
      'find',
      'where',
      'which',
      'what',
    ].some((token) => tokens.has(token));
  const subject = (orm && ormArtifact) || sqlSubject || repositorySubject;
  if (!subject) return false;
  return (
    locator ||
    ['defined', 'configured', 'saves', 'save', 'persist', 'persists'].some((token) =>
      tokens.has(token),
    ) ||
    tokens.size >= 3
  );
}

function searchIntegrationContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    tokens.has('github') &&
    ['action', 'actions', 'workflow', 'workflows', 'job', 'jobs', 'ci'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  const namedService = [
    'stripe',
    'sendgrid',
    's3',
    'github',
    'graphql',
    'websocket',
    'websockets',
    'socket',
    'sockets',
    'axios',
  ].some((token) => tokens.has(token));
  const genericService = [
    'integration',
    'integrations',
    'external',
    'service',
    'services',
    'client',
    'clients',
    'sdk',
    'sdks',
    'api',
    'apis',
  ].some((token) => tokens.has(token));
  const transportSubject = ['fetch', 'http', 'rest'].some((token) => tokens.has(token));
  const callAction = [
    'call',
    'calls',
    'called',
    'send',
    'sends',
    'sent',
    'upload',
    'uploads',
    'uploaded',
  ].some((token) => tokens.has(token));
  const emailProviderSubject =
    tokens.has('email') &&
    (tokens.has('sendgrid') ||
      ['send', 'sends', 'sent', 'through'].some((token) => tokens.has(token)));
  const storageSubject =
    tokens.has('s3') &&
    ['upload', 'uploads', 'uploaded', 'client', 'sdk', 'bucket'].some((token) => tokens.has(token));
  const graphSubject =
    tokens.has('graphql') &&
    ['query', 'queries', 'client', 'api'].some((token) => tokens.has(token));
  const socketSubject =
    ['websocket', 'websockets', 'socket', 'sockets'].some((token) => tokens.has(token)) &&
    ['connection', 'connections', 'opened', 'client'].some((token) => tokens.has(token));
  const apiClientSubject =
    namedService &&
    ['api', 'apis', 'client', 'clients', 'sdk', 'sdks'].some((token) => tokens.has(token));
  const subject =
    emailProviderSubject ||
    storageSubject ||
    graphSubject ||
    socketSubject ||
    apiClientSubject ||
    (namedService && (callAction || locator || genericService)) ||
    ((genericService || transportSubject) && callAction);
  if (!subject) return false;
  return locator || callAction || tokens.size >= 3;
}

function searchApiContractContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (tokens.has('public') && (tokens.has('contract') || tokens.has('contracts'))) return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const artifactAction = [
    'defined',
    'defines',
    'configured',
    'generated',
    'handles',
    'handled',
  ].some((token) => tokens.has(token));
  const openApiSubject =
    tokens.has('openapi') ||
    tokens.has('swagger') ||
    ((tokens.has('api') || tokens.has('apis')) &&
      (tokens.has('spec') || tokens.has('specs') || tokens.has('docs')));
  const trpcSubject =
    tokens.has('trpc') && (tokens.has('router') || tokens.has('routers') || locator);
  const graphqlSubject =
    tokens.has('graphql') &&
    ['schema', 'schemas', 'resolver', 'resolvers', 'query', 'queries'].some((token) =>
      tokens.has(token),
    );
  const protoSubject =
    ['protobuf', 'proto', 'protos'].some((token) => tokens.has(token)) ||
    (tokens.has('grpc') &&
      ['service', 'services', 'client', 'clients'].some((token) => tokens.has(token)));
  const subject = openApiSubject || trpcSubject || graphqlSubject || protoSubject;
  if (!subject) return false;
  return locator || artifactAction || tokens.size >= 3;
}

function searchInfraArtifactContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'fail',
      'failing',
      'failed',
      'failure',
      'failures',
      'error',
      'errors',
      'flake',
      'flaky',
      'slow',
      'slower',
    ].some((token) => tokens.has(token))
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const dockerSubject =
    tokens.has('dockerfile') ||
    tokens.has('containerfile') ||
    (tokens.has('docker') && tokens.has('compose'));
  const orchestrationSubject =
    tokens.has('kubernetes') ||
    tokens.has('k8s') ||
    tokens.has('manifest') ||
    tokens.has('manifests') ||
    tokens.has('helm') ||
    tokens.has('chart') ||
    tokens.has('charts');
  const iacSubject =
    tokens.has('terraform') ||
    tokens.has('tf') ||
    tokens.has('cloudformation') ||
    tokens.has('cdk') ||
    tokens.has('pulumi') ||
    ((tokens.has('module') || tokens.has('modules')) &&
      ['terraform', 'tf', 's3'].some((token) => tokens.has(token)));
  const hostedConfigSubject =
    ['vercel', 'netlify', 'railway', 'fly'].some((token) => tokens.has(token)) &&
    ['config', 'configuration', 'deploy', 'deployment'].some((token) => tokens.has(token));
  const workflowSubject =
    tokens.has('github') &&
    (tokens.has('workflow') || tokens.has('workflows')) &&
    ['deploy', 'deploys', 'deployment', 'staging', 'production'].some((token) => tokens.has(token));
  const subject =
    dockerSubject || orchestrationSubject || iacSubject || hostedConfigSubject || workflowSubject;
  if (!subject) return false;
  return (
    locator ||
    ['defined', 'configured', 'deploy', 'deploys', 'deployment'].some((token) =>
      tokens.has(token),
    ) ||
    tokens.size >= 3
  );
}

function searchDomainWorkflowContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const action = [
    'handled',
    'handles',
    'implemented',
    'creates',
    'created',
    'generated',
    'sent',
    'export',
    'exports',
  ].some((token) => tokens.has(token));
  const passwordReset = tokens.has('password') && tokens.has('reset');
  const inviteFlow = tokens.has('invite') || tokens.has('invites');
  const onboardingFlow = tokens.has('onboarding') && (tokens.has('flow') || tokens.has('flows'));
  const csvExport = tokens.has('csv') && (tokens.has('export') || tokens.has('exports'));
  const auditLog =
    tokens.has('audit') && (tokens.has('log') || tokens.has('logs') || tokens.has('entries'));
  const refundFlow = tokens.has('refund');
  const subscriptionRenewal = tokens.has('subscription') && tokens.has('renewal');
  const subject =
    passwordReset ||
    inviteFlow ||
    onboardingFlow ||
    csvExport ||
    auditLog ||
    refundFlow ||
    subscriptionRenewal;
  if (!subject) return false;
  return locator || action || tokens.size >= 3;
}

function searchCommunicationArtifactContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'leak',
      'leaks',
      'leaking',
      'logged',
      'logging',
      'store',
      'stores',
      'retention',
      'pii',
      'gdpr',
      'security',
    ].some((token) => tokens.has(token))
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const artifact = ['template', 'templates', 'copy', 'pdf'].some((token) => tokens.has(token));
  const emailSubject =
    (tokens.has('email') || tokens.has('emails')) &&
    (artifact || tokens.has('welcome') || tokens.has('receipt') || tokens.has('reset'));
  const pushSubject =
    tokens.has('push') &&
    (tokens.has('notification') || tokens.has('notifications')) &&
    tokens.has('copy');
  const smsSubject = tokens.has('sms') && (tokens.has('template') || tokens.has('verification'));
  const receiptSubject = tokens.has('receipt') && (tokens.has('email') || tokens.has('template'));
  const invoiceSubject = tokens.has('invoice') && tokens.has('pdf');
  const subject = emailSubject || pushSubject || smsSubject || receiptSubject || invoiceSubject;
  if (!subject) return false;
  return (
    locator ||
    ['send', 'sends', 'sent', 'generated', 'created'].some((token) => tokens.has(token)) ||
    tokens.size >= 3
  );
}

function searchStateManagementContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'leak',
      'leaks',
      'leaking',
      'logged',
      'logging',
      'retention',
      'pii',
      'gdpr',
      'security',
      'secret',
      'secrets',
      'token',
      'tokens',
      'password',
      'customer',
      'personal',
    ].some((token) => tokens.has(token))
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const frameworkSubject = ['redux', 'zustand', 'jotai', 'recoil'].some((token) =>
    tokens.has(token),
  );
  const storeSubject =
    (tokens.has('state') && ['store', 'stores', 'stored'].some((token) => tokens.has(token))) ||
    (frameworkSubject &&
      ['store', 'stores', 'slice', 'slices', 'selector', 'selectors'].some((token) =>
        tokens.has(token),
      ));
  const sliceSubject = frameworkSubject && (tokens.has('slice') || tokens.has('slices'));
  const selectorSubject = frameworkSubject && (tokens.has('selector') || tokens.has('selectors'));
  const contextSubject =
    tokens.has('context') &&
    ['provider', 'providers', 'supplies', 'supplied', 'provides', 'provided'].some((token) =>
      tokens.has(token),
    );
  const hookSubject =
    (tokens.has('hook') || tokens.has('hooks')) &&
    ['fetch', 'fetches', 'fetched', 'query', 'queries', 'mutation', 'mutations'].some((token) =>
      tokens.has(token),
    );
  const reactQuerySubject =
    tokens.has('react') &&
    tokens.has('query') &&
    ['query', 'queries', 'mutation', 'mutations', 'fetch', 'fetches', 'fetched'].some((token) =>
      tokens.has(token),
    );
  const subject =
    storeSubject ||
    sliceSubject ||
    selectorSubject ||
    contextSubject ||
    hookSubject ||
    reactQuerySubject;
  if (!subject) return false;
  return (
    locator ||
    ['stored', 'fetch', 'fetches', 'fetched', 'supplies', 'supplied', 'provides', 'provided'].some(
      (token) => tokens.has(token),
    ) ||
    tokens.size >= 3
  );
}

function searchNavigationLayoutContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const navSubject =
    ['sidebar', 'nav', 'navigation', 'menu'].some((token) => tokens.has(token)) &&
    ['item', 'items', 'billing', 'settings', 'checkout', 'route', 'routes'].some((token) =>
      tokens.has(token),
    );
  const breadcrumbSubject = tokens.has('breadcrumb') || tokens.has('breadcrumbs');
  const titleSubject =
    (tokens.has('page') && tokens.has('title')) || tokens.has('metadata') || tokens.has('meta');
  const layoutSubject =
    tokens.has('layout') &&
    (tokens.has('next') ||
      tokens.has('js') ||
      tokens.has('dashboard') ||
      tokens.has('page') ||
      tokens.has('route'));
  const subject = navSubject || breadcrumbSubject || titleSubject || layoutSubject;
  if (!subject) return false;
  return (
    locator ||
    ['renders', 'render', 'set', 'sets', 'configured', 'defined'].some((token) =>
      tokens.has(token),
    ) ||
    tokens.size >= 3
  );
}

function searchFrontendPageRouteContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'why',
      'returning',
      'returns',
      'failing',
      'failed',
      'failure',
      'failures',
      'production',
      'prod',
      'down',
      'outage',
      'incident',
      'runtime',
      'crash',
      'crashes',
      'crashing',
    ].some((token) => tokens.has(token))
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const renderSignal = [
    'render',
    'renders',
    'rendered',
    'handled',
    'defined',
    'located',
    'lives',
  ].some((token) => tokens.has(token));
  const pageSubject =
    tokens.has('page') &&
    (renderSignal ||
      ['billing', 'settings', 'checkout', 'dashboard', 'admin'].some((token) =>
        tokens.has(token),
      ) ||
      (tokens.has('not') && tokens.has('found')) ||
      tokens.has('404'));
  const routeSegmentSubject =
    (tokens.has('route') || tokens.has('routes')) &&
    (tokens.has('segment') || tokens.has('segments'));
  const notFoundSubject = tokens.has('page') && tokens.has('not') && tokens.has('found');
  const statusPageSubject = tokens.has('page') && tokens.has('404');
  const subject = pageSubject || routeSegmentSubject || notFoundSubject || statusPageSubject;
  if (!subject) return false;
  return locator || renderSignal || tokens.size >= 3;
}

function searchStyleSystemContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  if (
    [
      'why',
      'failing',
      'failed',
      'failure',
      'failures',
      'broken',
      'error',
      'errors',
      'runtime',
      'production',
      'prod',
      'outage',
      'incident',
    ].some((token) => tokens.has(token))
  )
    return false;
  const locator = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const styleSignal = [
    'defined',
    'define',
    'defines',
    'configured',
    'created',
    'loaded',
    'imported',
    'implemented',
    'handled',
    'styles',
    'style',
    'styled',
    'sets',
    'set',
  ].some((token) => tokens.has(token));
  const designTokenSubject = tokens.has('design') && (tokens.has('token') || tokens.has('tokens'));
  const tailwindSubject =
    tokens.has('tailwind') &&
    (tokens.has('theme') ||
      tokens.has('themes') ||
      tokens.has('config') ||
      tokens.has('configuration') ||
      styleSignal);
  const cssSubject =
    tokens.has('css') &&
    (tokens.has('global') ||
      tokens.has('module') ||
      tokens.has('modules') ||
      ['imported', 'styles', 'style', 'styled', 'defined', 'configured'].some((token) =>
        tokens.has(token),
      ));
  const darkModeSubject = tokens.has('dark') && tokens.has('mode');
  const breakpointSubject = tokens.has('breakpoint') || tokens.has('breakpoints');
  const colorSubject =
    ['color', 'colors', 'palette', 'palettes'].some((token) => tokens.has(token)) &&
    (tokens.has('theme') || tokens.has('design') || styleSignal);
  const subject =
    designTokenSubject ||
    tailwindSubject ||
    cssSubject ||
    darkModeSubject ||
    breakpointSubject ||
    colorSubject;
  if (!subject) return false;
  return locator || styleSignal || tokens.size >= 3;
}

function styleSystemFailureContextMatches(tokens: Set<string>): boolean {
  const styleSubject =
    (tokens.has('dark') && tokens.has('mode')) ||
    (tokens.has('design') && (tokens.has('token') || tokens.has('tokens'))) ||
    tokens.has('tailwind') ||
    tokens.has('css') ||
    tokens.has('breakpoint') ||
    tokens.has('breakpoints');
  return styleSubject && regressionFailureContextMatches(tokens);
}

function toolingFailureContextMatches(tokens: Set<string>): boolean {
  const toolingSubject = [
    'vite',
    'vitest',
    'jest',
    'babel',
    'webpack',
    'tsconfig',
    'typescript',
    'pnpm',
    'yarn',
    'npm',
  ].some((token) => tokens.has(token));
  return toolingSubject && regressionFailureContextMatches(tokens);
}

function searchUiInteractionContextMatches(tokens: Set<string>): boolean {
  if (
    ['add', 'create', 'implement', 'build', 'plan', 'should', 'todo', 'next'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const formSubject =
    (tokens.has('form') || tokens.has('forms')) &&
    ['submit', 'submits', 'submitted', 'handles', 'handled'].some((token) => tokens.has(token));
  const stateSubject =
    (tokens.has('state') && ['loading', 'empty', 'error'].some((token) => tokens.has(token))) ||
    (tokens.has('empty') && tokens.has('results'));
  const boundarySubject = tokens.has('boundary') && tokens.has('error');
  const notificationSubject = ['toast', 'notification', 'notifications'].some((token) =>
    tokens.has(token),
  );
  const shortcutSubject =
    tokens.has('keyboard') ||
    tokens.has('shortcut') ||
    tokens.has('shortcuts') ||
    (tokens.has('command') && tokens.has('palette'));
  const modalSubject = tokens.has('modal');
  const componentSubject =
    tokens.has('component') &&
    (tokens.has('page') || tokens.has('renders') || tokens.has('render'));
  const translationSubject =
    tokens.has('i18n') || tokens.has('translation') || tokens.has('translations');
  const accessibilitySubject = tokens.has('aria') || (tokens.has('focus') && tokens.has('trap'));
  const subject =
    formSubject ||
    stateSubject ||
    boundarySubject ||
    notificationSubject ||
    shortcutSubject ||
    modalSubject ||
    componentSubject ||
    translationSubject ||
    accessibilitySubject;
  if (!subject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'handles',
      'handled',
      'renders',
      'render',
      'shown',
      'triggers',
      'triggered',
      'opened',
      'implemented',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}

function explicitDataflowContextMatches(tokens: Set<string>): boolean {
  return [
    'dataflow',
    'taint',
    'source',
    'sink',
    'sinks',
    'reach',
    'reaches',
    'request',
    'exec',
    'injection',
    'sql',
    'xss',
    'sanitize',
    'sanitized',
    'security',
    'vulnerability',
    'bypass',
  ].some((token) => tokens.has(token));
}

function explicitDataflowRiskContextMatches(tokens: Set<string>): boolean {
  return [
    'dataflow',
    'taint',
    'source',
    'sink',
    'sinks',
    'reach',
    'reaches',
    'exec',
    'injection',
    'sql',
    'xss',
    'sanitize',
    'sanitized',
    'security',
    'vulnerability',
    'bypass',
    'secret',
    'secrets',
    'expose',
    'exposes',
    'exposed',
    'pii',
    'gdpr',
    'token',
    'tokens',
    'leak',
    'leaks',
  ].some((token) => tokens.has(token));
}

function searchConfigLookupContextMatches(tokens: Set<string>): boolean {
  const configSubject = tokens.has('config') || tokens.has('configuration');
  if (!configSubject) return false;
  if (
    [
      'need',
      'needs',
      'required',
      'requires',
      'missing',
      'contract',
      'contracts',
      'env',
      'environment',
      'vars',
      'variables',
    ].some((token) => tokens.has(token))
  )
    return false;
  const lookup = ['where', 'which', 'find', 'locate', 'search', 'lookup', 'show'].some((token) =>
    tokens.has(token),
  );
  const configDefinition =
    (tokens.has('file') || tokens.has('files')) &&
    ['define', 'defines', 'alias', 'aliases', 'configured', 'configures'].some((token) =>
      tokens.has(token),
    );
  return lookup || configDefinition;
}

function searchToolingConfigContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'add',
      'create',
      'implement',
      'build',
      'plan',
      'should',
      'todo',
      'update',
      'upgrade',
      'bump',
      'remove',
      'drop',
      'uninstall',
    ].some((token) => tokens.has(token))
  )
    return false;
  if (
    [
      'why',
      'failing',
      'failed',
      'failure',
      'failures',
      'broken',
      'error',
      'errors',
      'runtime',
      'production',
      'prod',
      'outage',
      'incident',
    ].some((token) => tokens.has(token))
  )
    return false;
  const lookup = ['where', 'which', 'what', 'find', 'locate', 'search', 'lookup', 'show'].some(
    (token) => tokens.has(token),
  );
  const configSignal = [
    'config',
    'configuration',
    'configured',
    'file',
    'files',
    'defined',
    'define',
    'defines',
  ].some((token) => tokens.has(token));
  const configTool =
    ['vite', 'vitest', 'jest', 'babel', 'webpack'].some((token) => tokens.has(token)) &&
    (configSignal || lookup);
  const tsconfigSubject =
    tokens.has('tsconfig') ||
    (tokens.has('typescript') &&
      ['config', 'configuration', 'path', 'paths', 'alias', 'aliases', 'strict'].some((token) =>
        tokens.has(token),
      ));
  const pathAliasSubject =
    ['path', 'paths'].some((token) => tokens.has(token)) &&
    ['alias', 'aliases'].some((token) => tokens.has(token)) &&
    (tokens.has('tsconfig') || tokens.has('typescript') || tokens.has('config'));
  const packageManagerSubject = tokens.has('package') && tokens.has('manager');
  const workspaceFileSubject =
    ['pnpm', 'yarn', 'npm'].some((token) => tokens.has(token)) &&
    ['workspace', 'workspaces', 'lockfile', 'lockfiles', 'package', 'manager'].some((token) =>
      tokens.has(token),
    );
  const subject =
    configTool ||
    tsconfigSubject ||
    pathAliasSubject ||
    packageManagerSubject ||
    workspaceFileSubject;
  if (!subject) return false;
  return lookup || configSignal || tokens.size >= 3;
}

function searchMigrationLookupContextMatches(tokens: Set<string>): boolean {
  const migrationSubject = tokens.has('migration') || tokens.has('migrations');
  if (!migrationSubject) return false;
  if (
    ['should', 'put', 'add', 'change', 'need', 'needs', 'plan', 'deploy', 'zero', 'downtime'].some(
      (token) => tokens.has(token),
    )
  )
    return false;
  if (
    [
      'impact',
      'breaks',
      'break',
      'breaking',
      'blast',
      'radius',
      'affect',
      'drop',
      'delete',
      'remove',
      'rollback',
      'revert',
    ].some((token) => tokens.has(token))
  )
    return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'show',
    'exist',
    'exists',
    'ran',
    'file',
    'files',
  ].some((token) => tokens.has(token));
}

function searchGeneratedContextMatches(tokens: Set<string>): boolean {
  if (!tokens.has('generated')) return false;
  if (
    ['write', 'create', 'generate', 'regenerate', 'build', 'emit'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  return [
    'where',
    'which',
    'what',
    'find',
    'locate',
    'search',
    'lookup',
    'show',
    'is',
    'code',
    'file',
    'files',
  ].some((token) => tokens.has(token));
}

function searchOwnershipContextMatches(tokens: Set<string>, hasFilePath: boolean): boolean {
  if (hasFilePath) return false;
  if (claimContextMatches(tokens)) return false;
  if (tokens.has('changed') && (tokens.has('file') || tokens.has('files'))) return false;
  if (
    ['pr', 'pull', 'request', 'review', 'reviewer', 'reviewers'].some((token) => tokens.has(token))
  )
    return false;
  const ownershipSignal = ['owner', 'owners', 'ownership', 'owns', 'team'].some((token) =>
    tokens.has(token),
  );
  const helpSignal = ['ask', 'help', 'knows', 'expert', 'experts', 'contact', 'contacts'].some(
    (token) => tokens.has(token),
  );
  const lookupSignal = ['who', 'which', 'find', 'locate', 'search', 'where'].some((token) =>
    tokens.has(token),
  );
  return (ownershipSignal && (lookupSignal || tokens.has('area'))) || (helpSignal && lookupSignal);
}

function searchDocumentationContextMatches(tokens: Set<string>): boolean {
  const locator = ['where', 'find', 'locate', 'search', 'lookup'].some((token) =>
    tokens.has(token),
  );
  const docsSubject = [
    'doc',
    'docs',
    'document',
    'documentation',
    'documented',
    'readme',
    'examples',
    'example',
    'guide',
  ].some((token) => tokens.has(token));
  return locator && docsSubject;
}

function fileHistoryContextMatches(tokens: Set<string>): boolean {
  return [
    'last',
    'recently',
    'history',
    'author',
    'authors',
    'blame',
    'touched',
    'touch',
    'changed',
  ].some((token) => tokens.has(token));
}

function fileTestContextMatches(tokens: Set<string>): boolean {
  if (['coverage', 'covered', 'uncovered', 'add', 'write'].some((token) => tokens.has(token)))
    return true;
  const testQuestion = tokens.has('test') || tokens.has('tests');
  const runOrLocationQuestion = ['run', 'rerun', 'where', 'find', 'locate', 'search'].some(
    (token) => tokens.has(token),
  );
  return testQuestion && !runOrLocationQuestion;
}

function impactDeleteContextMatches(tokens: Set<string>): boolean {
  return [
    'impact',
    'breaks',
    'break',
    'blast',
    'radius',
    'depends',
    'affect',
    'callers',
    'used',
    'usage',
    'referenced',
    'called',
    'breaking',
    'dead',
    'unused',
    'orphaned',
  ].some((token) => tokens.has(token));
}

function impactDatabaseContextMatches(tokens: Set<string>): boolean {
  const databaseSubject = ['database', 'db', 'schema', 'table', 'column', 'sql'].some((token) =>
    tokens.has(token),
  );
  const destructiveSubject = ['drop', 'schema', 'table', 'column', 'sql'].some((token) =>
    tokens.has(token),
  );
  const migrationSubject = tokens.has('migration') || tokens.has('migrations');
  const migrationImpactSignal = [
    'impact',
    'breaks',
    'break',
    'breaking',
    'blast',
    'radius',
    'affect',
    'drop',
    'delete',
    'remove',
    'rollback',
    'revert',
  ].some((token) => tokens.has(token));
  const breakQuestion = ['breaks', 'break', 'breaking'].some((token) => tokens.has(token));
  return (
    destructiveSubject ||
    (databaseSubject && breakQuestion) ||
    (migrationSubject && migrationImpactSignal)
  );
}

function impactApiKeywordMatches(keyword: string): boolean {
  return [
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
  ].includes(keyword);
}

function impactApiContextMatches(tokens: Set<string>): boolean {
  const apiSubject = [
    'api',
    'apis',
    'endpoint',
    'endpoints',
    'client',
    'clients',
    'contract',
    'contracts',
    'public',
  ].some((token) => tokens.has(token));
  const breakingSignal = [
    'impact',
    'break',
    'breaks',
    'breaking',
    'blast',
    'radius',
    'affect',
    'callers',
    'used',
    'usage',
    'referenced',
    'called',
    'rename',
    'remove',
    'delete',
    'deprecate',
    'deprecates',
    'deprecated',
    'deprecation',
    'change',
    'changes',
    'changing',
    'compatibility',
    'compatible',
    'version',
    'versions',
  ].some((token) => tokens.has(token));
  return apiSubject && breakingSignal;
}

function impactRollbackContextMatches(keyword: string, tokens: Set<string>): boolean {
  if (['revert', 'rollback', 'undo', 'backout'].includes(keyword)) return true;
  if (['back', 'out'].includes(keyword)) return tokens.has('back') && tokens.has('out');
  if (keyword === 'recover')
    return tokens.has('bad') || tokens.has('deploy') || tokens.has('deployment');
  return false;
}

function doctorCleanupDeleteContextMatches(
  tokens: Set<string>,
  hasFilePath: boolean,
  hasPackageRemoval: boolean,
): boolean {
  if (hasFilePath || hasPackageRemoval) return false;
  return (
    (tokens.has('safe') || tokens.has('safely') || tokens.has('cleanup') || tokens.has('clean')) &&
    (tokens.has('delete') || tokens.has('remove')) &&
    !impactDeleteContextMatches(tokens)
  );
}

function doctorCleanupDiscoveryContextMatches(tokens: Set<string>): boolean {
  const cleanupSignal = ['dead', 'unused', 'orphaned', 'cleanup', 'clean'].some((token) =>
    tokens.has(token),
  );
  if (!cleanupSignal) return false;
  return [
    'code',
    'export',
    'exports',
    'delete',
    'remove',
    'find',
    'search',
    'locate',
    'where',
  ].some((token) => tokens.has(token));
}

function preflightReadyContextMatches(tokens: Set<string>): boolean {
  return [
    'safe',
    'safety',
    'gate',
    'preflight',
    'commit',
    'merge',
    'edit',
    'proceed',
    'block',
    'blocked',
    'blocker',
    'blockers',
    'blocking',
    'allowed',
  ].some((token) => tokens.has(token));
}

function preflightRiskContextMatches(tokens: Set<string>): boolean {
  return [
    'safe',
    'safety',
    'gate',
    'preflight',
    'commit',
    'merge',
    'merged',
    'merging',
    'proceed',
    'block',
    'blocked',
    'blocker',
    'blockers',
    'blocking',
    'allowed',
  ].some((token) => tokens.has(token));
}

function preflightBranchRecoveryContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('test') || tokens.has('tests')) return false;
  const rebaseSignal = tokens.has('rebase') || tokens.has('rebasing');
  const conflictSignal = tokens.has('conflict') || tokens.has('conflicts');
  const resolveSignal = tokens.has('resolve') || tokens.has('resolving');
  const troubleSignal = tokens.has('wrong') || tokens.has('stuck');
  const mergeSignal =
    tokens.has('merge') ||
    tokens.has('merged') ||
    tokens.has('merging') ||
    tokens.has('main') ||
    tokens.has('branch');
  return (
    rebaseSignal ||
    ((conflictSignal || resolveSignal) && mergeSignal) ||
    (troubleSignal && (rebaseSignal || conflictSignal))
  );
}

function hotspotFileRiskContextMatches(tokens: Set<string>): boolean {
  return [
    'risk',
    'risks',
    'risky',
    'riskiest',
    'dangerous',
    'hotspot',
    'hotspots',
    'complex',
    'complexity',
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
    'performance',
    'perf',
    'bottleneck',
    'bottlenecks',
    'optimize',
    'optimise',
    'faster',
    'slow',
  ].some((token) => tokens.has(token));
}

function hotspotWhereContextMatches(tokens: Set<string>, hasFilePath: boolean): boolean {
  return (
    [
      'focus',
      'risky',
      'riskiest',
      'dangerous',
      'hotspot',
      'hotspots',
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
      'performance',
      'perf',
      'bottleneck',
      'bottlenecks',
      'optimize',
      'optimise',
      'faster',
      'slow',
    ].some((token) => tokens.has(token)) ||
    (!hasFilePath && tokens.has('start') && !localServiceSetupCommandContextMatches(tokens))
  );
}

function hotspotPerformanceContextMatches(tokens: Set<string>): boolean {
  if (tokens.has('slow') && regressionPerformanceContextMatches(tokens)) return false;
  return [
    'performance',
    'perf',
    'bottleneck',
    'bottlenecks',
    'optimize',
    'optimise',
    'faster',
    'slow',
  ].some((token) => tokens.has(token));
}

function prDiffKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  const commitMessageContext = tokens.has('commit') && tokens.has('message');
  const commitSummaryContext =
    tokens.has('commit') &&
    (tokens.has('summarize') || tokens.has('summary')) &&
    (tokens.has('change') || tokens.has('changes') || tokens.has('changed') || tokens.has('diff'));
  if (keyword === 'commit') return commitMessageContext || commitSummaryContext;
  if (keyword === 'message') return commitMessageContext && tokens.has('message');
  if (['summarize', 'summary'].includes(keyword)) return commitSummaryContext;
  if (['large', 'big', 'size', 'sizes'].includes(keyword)) return prSizeContextMatches(tokens);
  if (['compare', 'stale', 'branched', 'behind', 'ahead', 'sync', 'synced'].includes(keyword))
    return branchSyncDiffContextMatches(tokens);
  if (keyword === 'change') {
    return (
      prSizeContextMatches(tokens) ||
      ['did', 'since', 'branch', 'main', 'base', 'head', 'pr', 'diff'].some((token) =>
        tokens.has(token),
      )
    );
  }
  if (['since', 'branch', 'main', 'base', 'head'].includes(keyword)) {
    return (
      branchSyncDiffContextMatches(tokens) ||
      ['change', 'changed', 'changes', 'diff', 'pr', 'pull', 'request'].some((token) =>
        tokens.has(token),
      )
    );
  }
  return true;
}

function prSizeContextMatches(tokens: Set<string>): boolean {
  if (dependencyBloatContextMatches(tokens)) return false;
  const sizeSignal = ['large', 'big', 'size', 'sizes'].some((token) => tokens.has(token));
  const changeSubject = ['pr', 'pull', 'request', 'change', 'changes', 'diff', 'branch'].some(
    (token) => tokens.has(token),
  );
  return sizeSignal && changeSubject;
}

function branchSyncDiffContextMatches(tokens: Set<string>): boolean {
  if (
    ['conflict', 'conflicts', 'resolve', 'resolving', 'rebase', 'rebasing'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const syncSignal = ['compare', 'stale', 'branched', 'behind', 'ahead', 'sync', 'synced'].some(
    (token) => tokens.has(token),
  );
  const branchSubject = ['branch', 'main', 'base', 'head'].some((token) => tokens.has(token));
  return syncSignal && branchSubject;
}

function claimContextMatches(tokens: Set<string>): boolean {
  return ['claim', 'claims', 'lease', 'leases', 'reserve', 'lock'].some((token) =>
    tokens.has(token),
  );
}

function claimKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (['claim', 'claims', 'lease', 'leases', 'reserve', 'lock'].includes(keyword)) return true;
  return claimContextMatches(tokens);
}

function coordinateAgentContextMatches(tokens: Set<string>): boolean {
  return [
    'coordinate',
    'coordination',
    'status',
    'readiness',
    'parallel',
    'swarm',
    'collide',
    'colliding',
    'conflict',
    'conflicts',
    'conflicting',
    'conflicted',
    'worktree',
    'worktrees',
    'overlap',
  ].some((token) => tokens.has(token));
}

function coordinateWorkingContextMatches(tokens: Set<string>): boolean {
  return (
    (tokens.has('working') || tokens.has('editing')) && (tokens.has('who') || tokens.has('else'))
  );
}

function coordinateActiveContextMatches(tokens: Set<string>): boolean {
  return ['worktree', 'worktrees', 'agent', 'agents', 'parallel', 'swarm'].some((token) =>
    tokens.has(token),
  );
}

function coordinateConflictContextMatches(tokens: Set<string>): boolean {
  return [
    'coordinate',
    'coordination',
    'parallel',
    'agents',
    'agent',
    'swarm',
    'worktree',
    'worktrees',
    'collide',
    'colliding',
    'overlap',
    'overlapping',
  ].some((token) => tokens.has(token));
}

function collisionConflictContextMatches(tokens: Set<string>): boolean {
  return [
    'coordinate',
    'coordination',
    'parallel',
    'agents',
    'agent',
    'swarm',
    'worktree',
    'worktrees',
    'collision',
    'collide',
    'colliding',
    'overlap',
    'overlapping',
  ].some((token) => tokens.has(token));
}

function collisionChangeContextMatches(tokens: Set<string>): boolean {
  return [
    'overlap',
    'overlapping',
    'conflict',
    'conflicts',
    'collision',
    'collide',
    'colliding',
    'worktree',
    'worktrees',
  ].some((token) => tokens.has(token));
}

function mergeRiskKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'first')
    return ['merge', 'merged', 'merging', 'integrate', 'integration'].some((token) =>
      tokens.has(token),
    );
  if (keyword === 'branch')
    return ['first', 'order', 'sequence', 'integrate', 'integration'].some((token) =>
      tokens.has(token),
    );
  return true;
}

function sessionLeaveOffContextMatches(tokens: Set<string>): boolean {
  return tokens.has('off') && (tokens.has('leave') || tokens.has('left'));
}

function sessionAwayContextMatches(tokens: Set<string>): boolean {
  return (
    (tokens.has('away') || tokens.has('asleep') || tokens.has('slept') || tokens.has('offline')) &&
    ['changed', 'changes', 'change', 'last', 'previous', 'session', 'resume'].some((token) =>
      tokens.has(token),
    )
  );
}

function sessionAgentContextMatches(tokens: Set<string>): boolean {
  if (!tokens.has('agent')) return false;
  if (tokens.has('touch') || tokens.has('touched')) return false;
  return [
    'last',
    'previous',
    'did',
    'do',
    'changed',
    'changes',
    'session',
    'events',
    'history',
  ].some((token) => tokens.has(token));
}

function workplanDoContextMatches(tokens: Set<string>): boolean {
  return [
    'next',
    'plan',
    'workplan',
    'tasks',
    'task',
    'todo',
    'prioritize',
    'priorities',
    'roadmap',
  ].some((token) => tokens.has(token));
}

function workplanKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'do') return workplanDoContextMatches(tokens);
  if (
    [
      'build',
      'product',
      'products',
      'feature',
      'features',
      'strategy',
      'strategic',
      'priorities',
    ].includes(keyword)
  ) {
    return productPlanningContextMatches(tokens);
  }
  return true;
}

function productPlanningContextMatches(tokens: Set<string>): boolean {
  const planningSignal = [
    'next',
    'plan',
    'workplan',
    'tasks',
    'task',
    'todo',
    'prioritize',
    'priorities',
    'roadmap',
    'strategy',
    'strategic',
  ].some((token) => tokens.has(token));
  const productSignal = ['build', 'product', 'products', 'feature', 'features'].some((token) =>
    tokens.has(token),
  );
  return planningSignal && productSignal;
}

function bugHuntSpeedContextMatches(tokens: Set<string>): boolean {
  return (
    ['fix', 'issue', 'issues', 'bug', 'bugs', 'defect', 'broken', 'repair'].some((token) =>
      tokens.has(token),
    ) || bugHuntOpportunityContextMatches(tokens)
  );
}

function bugHuntOpportunityContextMatches(tokens: Set<string>): boolean {
  if (
    (tokens.has('improve') || tokens.has('improvement')) &&
    tokens.has('next') &&
    !protectedImproveNextContextMatches(tokens)
  )
    return true;
  const opportunityTokens = [
    'quick',
    'quickest',
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
    'win',
    'wins',
  ];
  const count = opportunityTokens.filter((token) => tokens.has(token)).length;
  return (
    count >= 2 ||
    [
      'intern',
      'interns',
      'fix',
      'issue',
      'issues',
      'bug',
      'bugs',
      'defect',
      'broken',
      'repair',
      'cleanup',
      'clean',
    ].some((token) => tokens.has(token))
  );
}

function protectedImproveNextContextMatches(tokens: Set<string>): boolean {
  if (!(tokens.has('improve') || tokens.has('improvement')) || !tokens.has('next')) return false;
  return [
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
    'dependency',
    'dependencies',
    'deps',
    'package',
    'packages',
    'supply-chain',
    'license',
    'licenses',
    'audit',
    'outdated',
    'upgrade',
    'vulnerable',
    'safe',
    'safety',
    'gate',
    'commit',
    'merge',
    'preflight',
    'blocker',
    'blockers',
    'risk',
    'risks',
  ].some((token) => tokens.has(token));
}

function testRunContextMatches(tokens: Set<string>): boolean {
  return tokens.has('test') || tokens.has('tests');
}

function regressionFailureContextMatches(tokens: Set<string>): boolean {
  const failureSignal = [
    'fail',
    'failing',
    'failed',
    'failure',
    'failures',
    'error',
    'errors',
  ].some((token) => tokens.has(token));
  const statusCodeSignal = ['500', '502', '503', '504', '404', '403', '401'].some((token) =>
    tokens.has(token),
  );
  const downOutageSignal =
    tokens.has('down') &&
    ['production', 'prod', 'service', 'site', 'app', 'api', 'outage'].some((token) =>
      tokens.has(token),
    );
  const outageSignal =
    downOutageSignal ||
    ['production', 'prod', 'outage', 'incident', 'runtime', 'crash', 'crashes', 'crashing'].some(
      (token) => tokens.has(token),
    );
  const connectionRefusedSignal = tokens.has('connection') && tokens.has('refused');
  const localSetupSignal = regressionLocalSetupContextMatches(tokens);
  const triageSignal = tokens.has('triage') && outageSignal;
  const stackTraceSignal = tokens.has('stack') && tokens.has('trace');
  const debugSignal =
    tokens.has('debug') &&
    (tokens.has('stack') || tokens.has('trace') || tokens.has('error') || tokens.has('errors'));
  const rootCauseSignal =
    tokens.has('root') &&
    tokens.has('cause') &&
    (failureSignal || statusCodeSignal || outageSignal);
  const returningStatusSignal =
    (tokens.has('returning') || tokens.has('returns')) && statusCodeSignal;
  const logFailureSignal =
    (tokens.has('log') || tokens.has('logs')) &&
    (failureSignal || outageSignal || statusCodeSignal);
  return (
    failureSignal ||
    statusCodeSignal ||
    outageSignal ||
    connectionRefusedSignal ||
    localSetupSignal ||
    triageSignal ||
    stackTraceSignal ||
    debugSignal ||
    rootCauseSignal ||
    returningStatusSignal ||
    logFailureSignal
  );
}

function regressionLocalSetupContextMatches(tokens: Set<string>): boolean {
  const portSignal =
    tokens.has('eaddrinuse') ||
    ((tokens.has('port') || tokens.has('ports')) &&
      ['already', 'use', 'used', 'listen', 'address', 'startup', 'start', 'server', 'dev'].some(
        (token) => tokens.has(token),
      ));
  const permissionSignal = tokens.has('permission') && tokens.has('denied');
  const packageManagerSignal =
    tokens.has('enoent') ||
    tokens.has('eresolve') ||
    (tokens.has('peer') &&
      ['dependency', 'dependencies', 'conflict', 'install', 'npm', 'pnpm', 'yarn'].some((token) =>
        tokens.has(token),
      ));
  return portSignal || permissionSignal || packageManagerSignal;
}

function regressionCiPlatformContextMatches(tokens: Set<string>): boolean {
  const platformSignal =
    tokens.has('ci') ||
    tokens.has('github') ||
    ['action', 'actions', 'workflow', 'workflows', 'pipeline', 'pipelines'].some((token) =>
      tokens.has(token),
    );
  const explicitTroubleSignal = [
    'fail',
    'failing',
    'failed',
    'failure',
    'failures',
    'error',
    'errors',
    'slow',
    'slower',
    'flake',
    'flaky',
    'flakes',
    'intermittent',
    'intermittently',
  ].some((token) => tokens.has(token));
  return (
    platformSignal &&
    (explicitTroubleSignal ||
      regressionFailureContextMatches(tokens) ||
      regressionPerformanceContextMatches(tokens) ||
      regressionFlakeContextMatches(tokens))
  );
}

function regressionPerformanceContextMatches(tokens: Set<string>): boolean {
  if (
    (tokens.has('find') || tokens.has('locate') || tokens.has('search')) &&
    (tokens.has('test') || tokens.has('tests')) &&
    (tokens.has('slow') || tokens.has('slower'))
  ) {
    return false;
  }
  const performanceSignal = [
    'slow',
    'slower',
    'speed',
    'speedup',
    'faster',
    'benchmark',
    'benchmarks',
  ].some((token) => tokens.has(token));
  if (!performanceSignal) return false;
  return (
    regressionBenchmarkContextMatches(tokens) ||
    [
      'ci',
      'github',
      'action',
      'actions',
      'workflow',
      'workflows',
      'pipeline',
      'pipelines',
      'test',
      'tests',
      'build',
      'builds',
    ].some((token) => tokens.has(token))
  );
}

function regressionBenchmarkContextMatches(tokens: Set<string>): boolean {
  return ['benchmark', 'benchmarks'].some((token) => tokens.has(token));
}

function regressionFlakeContextMatches(tokens: Set<string>): boolean {
  const flakeSignal = [
    'flake',
    'flaky',
    'flakes',
    'intermittent',
    'intermittently',
    'nondeterministic',
    'nondeterminism',
  ].some((token) => tokens.has(token));
  const verificationSubject = [
    'ci',
    'github',
    'action',
    'actions',
    'workflow',
    'workflows',
    'pipeline',
    'pipelines',
    'test',
    'tests',
    'suite',
    'failure',
    'failures',
    'fail',
    'failing',
    'failed',
  ].some((token) => tokens.has(token));
  const reproduceSignal = ['command', 'commands', 'reproduce', 'reproduces', 'reproducing'].some(
    (token) => tokens.has(token),
  );
  const stabilizationSignal = ['stabilize', 'stabilise', 'quarantine'].some((token) =>
    tokens.has(token),
  );
  const raceSignal = tokens.has('race') && (tokens.has('condition') || verificationSubject);

  if (flakeSignal)
    return verificationSubject || reproduceSignal || stabilizationSignal || raceSignal;
  if (raceSignal) return true;
  return (reproduceSignal || stabilizationSignal) && verificationSubject;
}

function proofCommandContextMatches(tokens: Set<string>): boolean {
  return [
    'proof',
    'prove',
    'verify',
    'verification',
    'regression',
    'test',
    'tests',
    'push',
    'pushing',
  ].some((token) => tokens.has(token));
}

function releaseReadinessContextMatches(tokens: Set<string>): boolean {
  return [
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
  ].some((token) => tokens.has(token));
}

function releaseTrainKeywordMatches(keyword: string, tokens: Set<string>): boolean {
  if (keyword === 'check') return releaseReadinessContextMatches(tokens);
  if (['changed', 'since', 'last'].includes(keyword)) {
    return (
      releaseCommunicationContextMatches(tokens) &&
      (tokens.has('changed') || tokens.has('change') || tokens.has('changes'))
    );
  }
  if (
    ['note', 'notes', 'draft', 'entry', 'summarize', 'summary', 'change', 'changes'].includes(
      keyword,
    )
  ) {
    return releaseCommunicationContextMatches(tokens);
  }
  return true;
}

function releaseCommunicationContextMatches(tokens: Set<string>): boolean {
  return [
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
  ].some((token) => tokens.has(token));
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

function keywordWeight(entry: RouteEntry, keyword: string): number {
  if (entry.tool === 'projscan_privacy_check') {
    if (
      [
        'privacy',
        'trust',
        'boundary',
        'env',
        'upload',
        'telemetry',
        'network',
        'offline',
        'leave',
        'machine',
      ].includes(keyword)
    )
      return 3;
    if (
      [
        'read',
        'code',
        'source',
        'values',
        'contact',
        'contacted',
        'write',
        'writes',
        'projscan',
      ].includes(keyword)
    )
      return 2;
  }
  if (
    entry.tool === 'projscan_understand' &&
    [
      'read',
      'summarize',
      'summary',
      'contract',
      'contracts',
      'api',
      'apis',
      'deprecate',
      'deprecates',
      'deprecated',
      'deprecation',
      'compatibility',
      'compatible',
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
      'start',
      'app',
      'command',
      'commands',
      'dev',
      'server',
      'local',
      'locally',
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
      'environment',
      'environments',
      'variable',
      'variables',
      'missing',
      'required',
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
      'migration',
      'migrations',
      'migrate',
      'migrates',
      'database',
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
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_file' && keyword === 'read') return 3;
  if (entry.tool === 'projscan_file' && ['review', 'reviewer', 'reviewers'].includes(keyword))
    return 5;
  if (
    entry.tool === 'projscan_file' &&
    ['file', 'explain', 'inspect', 'owns', 'risk', 'risks', 'risky', 'dangerous'].includes(keyword)
  )
    return 2;
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
  )
    return 2;
  if (entry.tool === 'projscan_file' && ['add', 'write'].includes(keyword)) return 2;
  if (
    entry.tool === 'projscan_file' &&
    ['coverage', 'covered', 'uncovered', 'test', 'tests'].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_impact' && ['delete', 'remove'].includes(keyword)) return 2;
  if (
    entry.tool === 'projscan_impact' &&
    ['drop', 'schema', 'table', 'column', 'database', 'db', 'migration', 'migrations'].includes(
      keyword,
    )
  )
    return 2;
  if (
    entry.tool === 'projscan_impact' &&
    ['revert', 'rollback', 'undo', 'backout', 'back', 'out', 'recover'].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_impact' &&
    ['depends', 'used', 'usage', 'referenced', 'called'].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_impact' &&
    [
      'api',
      'apis',
      'endpoint',
      'endpoints',
      'client',
      'clients',
      'contract',
      'contracts',
      'deprecate',
      'deprecates',
      'deprecated',
      'deprecation',
      'compatibility',
      'compatible',
      'version',
      'versions',
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_impact' && ['change', 'changes', 'changing'].includes(keyword))
    return 3;
  if (entry.tool === 'projscan_explain_issue' && keyword === 'explain') return 2;
  if (
    entry.tool === 'projscan_semantic_graph' &&
    [
      'import',
      'imports',
      'importers',
      'exports',
      'defined',
      'definition',
      'uses',
      'depend',
      'depends',
      'installed',
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_coupling') {
    if (['circular', 'cycle', 'cycles'].includes(keyword)) return 3;
    if (
      [
        'coupling',
        'coupled',
        'tightly',
        'module',
        'modules',
        'dependency',
        'dependencies',
        'import',
        'imports',
        'fan',
        'instability',
        'architecture',
        'boundary',
        'boundaries',
      ].includes(keyword)
    )
      return 2;
  }
  if (
    entry.tool === 'projscan_coverage' &&
    [
      'coverage',
      'untested',
      'uncovered',
      'scariest',
      'gap',
      'gaps',
      'test',
      'tests',
      'file',
      'files',
      'no',
      'missing',
      'without',
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_dependencies' &&
    ['dependencies', 'dependency', 'deps', 'package', 'packages', 'inventory', 'declared'].includes(
      keyword,
    )
  )
    return 2;
  if (
    entry.tool === 'projscan_dependencies' &&
    [
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
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_dependencies' &&
    [
      'license',
      'licenses',
      'gpl',
      'copyleft',
      'notice',
      'notices',
      'third',
      'party',
      'open',
      'source',
      'compliance',
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_workspaces' &&
    [
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
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_upgrade' &&
    ['upgrade', 'bump', 'update', 'remove', 'drop', 'uninstall', 'package'].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_audit') {
    if (
      [
        'audit',
        'cve',
        'cves',
        'vulnerable',
        'vulnerability',
        'vulnerabilities',
        'security',
        'secure',
        'safe',
      ].includes(keyword)
    )
      return 2;
    if (['dependency', 'dependencies', 'package', 'packages', 'npm'].includes(keyword)) return 1;
  }
  if (
    entry.tool === 'projscan_dataflow' &&
    [
      'dataflow',
      'taint',
      'security',
      'injection',
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
      'creates',
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
      'query',
      'queries',
      'mutation',
      'mutations',
      'fetches',
      'fetched',
      'invoices',
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_search' &&
    [
      'page',
      'segment',
      'segments',
      'not',
      'found',
      '404',
      'render',
      'renders',
      'rendered',
      'handled',
      'route',
      'routes',
      'dashboard',
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_search' &&
    [
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
      'loaded',
      'loader',
      'parse',
      'parses',
      'middleware',
      'api',
      'apis',
      'route',
      'routes',
      'endpoint',
      'endpoints',
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
      'show',
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 2;
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
    ].includes(keyword)
  )
    return 3;
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
      'fail',
      'build',
      'builds',
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
      'proof',
      'prove',
      'regression',
      'verification',
      'verify',
      'smoke',
      'focused',
      'full',
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
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_agent_brief' && ['brief', 'handoff', 'agent'].includes(keyword))
    return 2;
  if (
    entry.tool === 'projscan_session' &&
    [
      'session',
      'touched',
      'touch',
      'resume',
      'leave',
      'left',
      'off',
      'agent',
      'asleep',
      'slept',
      'away',
      'offline',
      'changed',
      'events',
      'history',
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_quality_scorecard' &&
    ['quality', 'scorecard', 'risk', 'risks', 'risky', 'picture'].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_hotspots' &&
    [
      'files',
      'file',
      'touch',
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
      'performance',
      'perf',
      'bottleneck',
      'bottlenecks',
      'optimize',
      'optimise',
      'faster',
      'slow',
    ].includes(keyword)
  )
    return 2;
  if (
    entry.tool === 'projscan_coordinate' &&
    [
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
      'active',
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_preflight' && keyword === 'ready') return 2;
  if (
    entry.tool === 'projscan_preflight' &&
    ['block', 'blocked', 'blocker', 'blockers', 'blocking'].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_preflight' && ['risk', 'risks'].includes(keyword)) return 2;
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
    ].includes(keyword)
  )
    return 2;
  if (entry.tool === 'projscan_claim') {
    if (keyword === 'active') return 0.5;
    if (['claim', 'claims', 'lease', 'leases', 'reserve', 'lock'].includes(keyword)) return 2;
  }
  if (entry.tool === 'projscan_evidence_pack') {
    if (keyword === 'pr') return 0.25;
    if (['changed', 'file', 'files'].includes(keyword)) return 1;
    if (
      [
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
      ].includes(keyword)
    )
      return 2;
  }
  if (entry.tool === 'projscan_doctor') {
    if (keyword === 'unused') return 3;
    if (['dead', 'orphaned'].includes(keyword)) return 2;
    if (['delete', 'remove'].includes(keyword)) return 2;
    if (['safe', 'safely'].includes(keyword)) return 1;
  }
  if (entry.tool === 'projscan_review' && keyword === 'review') return 2;
  if (entry.tool === 'projscan_review' && keyword === 'pr') return 0.25;
  if (entry.tool === 'projscan_review' && ['secure', 'security'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_review' && ['risk', 'risks', 'risky'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_regression_plan' && keyword === 'pr') return 0.25;
  if (entry.tool === 'projscan_pr_diff') {
    if (keyword === 'pr') return 0.25;
    if (['since', 'branch', 'main', 'base', 'head'].includes(keyword)) return 0.5;
    if (
      [
        'commit',
        'message',
        'summarize',
        'summary',
        'diff',
        'changed',
        'changes',
        'change',
        'compare',
        'stale',
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
      ].includes(keyword)
    )
      return 2;
  }
  if (entry.tool === 'projscan_collision' && ['overlapping'].includes(keyword)) return 3;
  if (entry.tool === 'projscan_collision' && ['collide', 'colliding'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_merge_risk' && keyword === 'first') return 1;
  if (entry.tool === 'projscan_release_train') {
    if (keyword === 'releasing') return 2;
    if (['deploy', 'deploying', 'deployed', 'deployment'].includes(keyword)) return 2;
    if (['changed', 'since', 'last'].includes(keyword)) return 2;
    if (['changelog', 'note', 'notes', 'entry', 'summarize', 'summary'].includes(keyword)) return 2;
  }
  if (entry.tool === 'projscan_bug_hunt') {
    if (
      [
        'bug',
        'bugs',
        'hunt',
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
        'win',
        'wins',
      ].includes(keyword)
    )
      return 2;
    if (['find', 'fix', 'pr'].includes(keyword)) return 0.25;
  }
  return 1;
}

function hasFilePathTarget(intent: string): boolean {
  return /(?:^|\s)[A-Za-z0-9_./:@-]+\.[A-Za-z0-9]{1,12}(?=[\s?!.,;:]|$)/.test(intent);
}

function hasEnvVarTarget(intent: string): boolean {
  return (
    /\bprocess\.env\.[A-Za-z_][A-Za-z0-9_]*\b/.test(intent) ||
    /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(intent)
  );
}

function hasQuotedTextTarget(intent: string): boolean {
  return /(["'`])\S.{0,200}?\1/.test(intent);
}

function hasPackageRemovalTarget(intent: string): boolean {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const actionFirst = compactIntent.match(
    /\b(?:remove|drop|uninstall)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  const targetFirst = compactIntent.match(
    /\b(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)\s+(?:safe\s+to\s+)?(?:remove|drop|uninstall)\b/i,
  );
  const match = actionFirst ?? targetFirst;
  const target = match?.[1]?.toLowerCase();
  if (!target) return false;
  return ![
    'this',
    'that',
    'it',
    'thing',
    'file',
    'files',
    'function',
    'method',
    'class',
    'symbol',
    'code',
    'for',
    'safe',
    'safely',
    'carefully',
    'docs',
    'doc',
    'documentation',
    'document',
    'readme',
    'changelog',
    'examples',
    'example',
    'guide',
  ].includes(target);
}

function hasPackageChangeTarget(intent: string): boolean {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const actionFirst = compactIntent.match(
    /\b(?:bump|upgrade|update)\s+(?:the\s+)?(?:(?:package|dependency)\s+)?(@?[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)?)(?=\s|$)/i,
  );
  const target = actionFirst?.[1]?.toLowerCase();
  if (!target) return false;
  return ![
    'this',
    'that',
    'it',
    'thing',
    'file',
    'files',
    'function',
    'method',
    'class',
    'symbol',
    'code',
    'for',
    'docs',
    'doc',
    'documentation',
    'document',
    'readme',
    'changelog',
    'examples',
    'example',
    'guide',
  ].includes(target);
}

function routeConfidence(score: number): RouteConfidence {
  if (score >= 2) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}
