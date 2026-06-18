import type { PreflightSuggestedAction } from '../types/preflight.js';

const COUPLING_FOLLOW_UP_CRITERION =
  'Every high-coupling or circular-import target has an owner, refactor decision, or verification follow-up before architecture work starts.';

export function couplingSuccessCriteria(
  primaryAction: PreflightSuggestedAction | undefined,
): string[] {
  const direction =
    primaryAction?.args && 'direction' in primaryAction.args
      ? String(primaryAction.args.direction)
      : 'all';
  return [
    direction === 'cycles_only'
      ? 'Circular-import cycles are reviewed with the exact files participating in each strongly connected component.'
      : 'Fan-in, fan-out, instability, cross-package edges, and circular-import cycles are reviewed before refactoring boundaries.',
    COUPLING_FOLLOW_UP_CRITERION,
  ];
}
