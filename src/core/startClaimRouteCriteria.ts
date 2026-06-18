import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { StartRoutedIntent } from '../types/start.js';

export interface ClaimSuccessCriteriaInput {
  route?: StartRoutedIntent;
  actionPlan: PreflightSuggestedAction[];
}

export function claimRouteSuccessCriteria(
  context: ClaimSuccessCriteriaInput,
): string[] | undefined {
  if (context.route?.tool !== 'projscan_claim') return undefined;
  const hasAddAction = context.actionPlan.some(
    (action) => action.args && 'action' in action.args && action.args.action === 'add',
  );
  if (hasAddAction) {
    return [
      'Active claims are reviewed before a new file, directory, or symbol claim is added.',
      'The target is claimed with a real agent name, and any returned contention is assigned or resolved before parallel editing continues.',
    ];
  }
  return [
    'Active claims, owners, leases, and contention warnings are reviewed before parallel work continues.',
    'Any stale or contended claim has a release, owner, or coordination follow-up before editing resumes.',
  ];
}
