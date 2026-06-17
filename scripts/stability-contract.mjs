import { createStableSurface as createSurfaceFromManifest } from './stability-surface.mjs';

// CLI commands that are part of the stable surface (per STABILITY.md). Edit
// this list ONLY on a major version bump; otherwise additions go through
// the baseline-diff path automatically.
const STABLE_CLI_COMMANDS = [
  'agent-brief',
  'analyze',
  'apply-fix',
  'audit',
  'badge',
  'bug-hunt',
  'ci',
  'coupling',
  'coverage',
  'dataflow',
  'dependencies',
  'diagram',
  'diff',
  'doctor',
  'dogfood',
  'evidence-pack',
  'explain-issue',
  'feedback',
  'file',
  'first-run',
  'fix',
  'fix-suggest',
  'handoff',
  'hotspots',
  'impact',
  'init',
  'install-hook',
  'mcp',
  'memory',
  'outdated',
  'plugin',
  'preflight',
  'pr-diff',
  'quality-scorecard',
  'recipes',
  'release-train',
  'regression-plan',
  'review',
  'search',
  'semantic-graph',
  'session',
  'structure',
  'taint',
  'trial',
  'understand',
  'upgrade',
  'watch',
  'workplan',
  'workspace',
  'workspaces',
];

const STABLE_EXIT_CODES = {
  success: 0,
  issues: 1,
  invalidUsage: 2,
};

export function createStableSurface(manifest, options = {}) {
  return createSurfaceFromManifest(manifest, {
    cliCommands: STABLE_CLI_COMMANDS,
    exitCodes: STABLE_EXIT_CODES,
    ...options,
  });
}
