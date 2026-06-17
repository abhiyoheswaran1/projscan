export interface KeywordWeightedRouteEntry {
  tool: string;
}

export function keywordWeight(entry: KeywordWeightedRouteEntry, keyword: string): number {
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
