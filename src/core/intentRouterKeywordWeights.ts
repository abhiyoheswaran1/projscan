import { isPrDiffKeyword } from './intentRouterPrDiffKeywords.js';
import { regressionPlanKeywordWeight } from './intentRouterRegressionKeywordWeights.js';
import { searchKeywordWeight } from './intentRouterSearchKeywordWeights.js';
import { workflowKeywordWeight } from './intentRouterWorkflowKeywordWeights.js';

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
      'auth',
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
  if (entry.tool === 'projscan_feedback_intake') {
    if (['feedback', 'reviewer', 'reviewers', 'user', 'users', 'intake'].includes(keyword))
      return 3;
    if (
      [
        'false',
        'positive',
        'unused',
        'exports',
        'alias',
        'import',
        'noisy',
        'noise',
        'caution',
        'signal',
        'doc',
        'docs',
        'output',
        'outputs',
        'wording',
        'confusing',
        'bigger',
        'demonstrated',
        'feature',
        'features',
        'breadth',
        'killer',
        'engineer',
        'engineers',
        'trust',
        'daily',
        'few',
        'workflow',
        'workflows',
        'overclaim',
        'overclaims',
        'wrong',
        'incorrect',
      ].includes(keyword)
    )
      return 2;
    if (['allow', 'script', 'scripts', 'warning', 'warnings', 'tree', 'sitter'].includes(keyword))
      return 3;
    if (['node', 'gyp'].includes(keyword)) return 2;
  }
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
  if (entry.tool === 'projscan_search') {
    const weight = searchKeywordWeight(keyword);
    if (weight !== undefined) return weight;
  }
  if (entry.tool === 'projscan_regression_plan') {
    const weight = regressionPlanKeywordWeight(keyword);
    if (weight !== undefined) return weight;
  }
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
  if (entry.tool === 'projscan_analyze') {
    if (['redact', 'redacted', 'redaction', 'scoped', 'scope'].includes(keyword)) return 3;
    if (
      [
        'share',
        'shared',
        'shareable',
        'sharing',
        'evidence',
        'artifact',
        'artifacts',
        'export',
        'exports',
        'external',
        'partner',
        'vendor',
        'security',
        'paths',
        'report',
        'reports',
      ].includes(keyword)
    )
      return 2;
  }
  const workflowWeight = workflowKeywordWeight(entry.tool, keyword);
  if (workflowWeight !== undefined) return workflowWeight;
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
  if (entry.tool === 'projscan_pr_diff') {
    if (keyword === 'pr') return 0.25;
    if (['since', 'branch', 'main', 'base', 'head'].includes(keyword)) return 0.5;
    if (isPrDiffKeyword(keyword)) return 2;
  }
  if (entry.tool === 'projscan_collision' && ['overlapping'].includes(keyword)) return 3;
  if (entry.tool === 'projscan_collision' && ['collide', 'colliding'].includes(keyword)) return 2;
  if (entry.tool === 'projscan_merge_risk' && keyword === 'first') return 1;
  return 1;
}
