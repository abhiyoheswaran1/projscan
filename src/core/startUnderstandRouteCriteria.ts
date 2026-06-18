import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { StartRoutedIntent } from '../types/start.js';

const UNDERSTAND_VIEW_CRITERIA: Record<string, string[]> = {
  flow: [
    'Runtime entrypoints, flow paths, and side-effect evidence are reviewed before changing request or execution paths.',
    'The developer knows which files sit on the relevant runtime path.',
  ],
  verify: [
    'Verification tiers, direct-test gaps, and likely proof commands are reviewed before pushing or asking for review.',
    'The developer has the smallest rerunnable command plus the fallback full gate for the intended change.',
  ],
  change: [
    'Change-readiness risks, blast radius, and verification tiers are reviewed before editing starts.',
    'The developer knows which follow-up impact, test, or preflight command gates the change.',
  ],
  map: [
    'Read-first files, entrypoints, boundaries, risks, and unknowns are reviewed before editing starts.',
    'The developer has a cited repo map and knows which files to inspect next.',
  ],
};

export function understandSuccessCriteria(
  primaryAction: PreflightSuggestedAction | undefined,
  route?: StartRoutedIntent,
): string[] {
  const view =
    primaryAction?.args && 'view' in primaryAction.args ? String(primaryAction.args.view) : 'map';
  if (view === 'contracts')
    return contractUnderstandSuccessCriteria(new Set(route?.matchedKeywords ?? []));
  return UNDERSTAND_VIEW_CRITERIA[view] ?? UNDERSTAND_VIEW_CRITERIA.map;
}

function contractUnderstandSuccessCriteria(matched: Set<string>): string[] {
  if (contractLocalServiceSetupCriteriaMatches(matched)) {
    return [
      'Local service startup scripts, container commands, and required config are reviewed before running dev services.',
      'The developer knows the safest command to start local services plus any env, port, or dependency preconditions.',
    ];
  }
  if (contractScriptDiscoveryCriteriaMatches(matched)) {
    return [
      'Package scripts, test commands, and config contracts are reviewed before running local commands.',
      'The developer knows the package-manager command for the requested script plus any required env or setup preconditions.',
    ];
  }
  if (contractDatabaseSetupCriteriaMatches(matched)) {
    return [
      'Package scripts and config contracts identify the seed, reset, or migration command before shell commands are guessed.',
      'The developer knows database setup preconditions, required env vars, and the safest local command to run.',
    ];
  }
  if (contractEnvCriteriaMatches(matched)) {
    return [
      'Required environment variables and config contracts are identified before setup or runtime troubleshooting continues.',
      'The developer knows which env names, defaults, or config files need local values before running the app.',
    ];
  }
  return [
    'Public exports, config contracts, and likely breaking-change risks are reviewed before touching API surfaces.',
    'The developer knows which exported files or symbols need compatibility checks.',
  ];
}

function contractScriptDiscoveryCriteriaMatches(matched: Set<string>): boolean {
  return [
    'npm',
    'script',
    'scripts',
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
  ].some((keyword) => matched.has(keyword));
}

function contractLocalServiceSetupCriteriaMatches(matched: Set<string>): boolean {
  const action = ['run', 'runs', 'start', 'command', 'commands', 'setup'].some((keyword) =>
    matched.has(keyword),
  );
  const localServices =
    ['local', 'locally', 'dev'].some((keyword) => matched.has(keyword)) &&
    ['service', 'services', 'server', 'app'].some((keyword) => matched.has(keyword));
  const dockerCompose = matched.has('docker') && matched.has('compose');
  return action && (localServices || dockerCompose);
}

function contractDatabaseSetupCriteriaMatches(matched: Set<string>): boolean {
  return (
    ['database', 'db', 'migration', 'migrations'].some((keyword) => matched.has(keyword)) &&
    ['seed', 'seeds', 'reset', 'resets', 'migrate', 'migrates', 'run', 'runs', 'command'].some(
      (keyword) => matched.has(keyword),
    )
  );
}

function contractEnvCriteriaMatches(matched: Set<string>): boolean {
  return [
    'env',
    'environment',
    'environments',
    'vars',
    'variable',
    'variables',
    'missing',
    'required',
  ].some((keyword) => matched.has(keyword));
}
