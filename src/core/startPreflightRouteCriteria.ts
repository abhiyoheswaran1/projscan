import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { StartRoutedIntent } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

export interface PreflightSuccessCriteriaInput {
  mode: WorkplanMode;
  route?: StartRoutedIntent;
  primaryAction?: PreflightSuggestedAction;
}

export function isPreflightAction(action: PreflightSuggestedAction): boolean {
  return (
    action.tool === 'projscan_preflight' ||
    action.command?.startsWith('projscan preflight ') === true
  );
}

export function preflightModeForMission(
  mode: WorkplanMode,
): 'before_edit' | 'before_commit' | 'before_merge' {
  if (mode === 'before_commit') return 'before_commit';
  if (mode === 'hardening') return 'before_commit';
  if (mode === 'before_merge' || mode === 'release') return 'before_merge';
  return 'before_edit';
}

export function preflightSuccessCriteria(
  context: PreflightSuccessCriteriaInput,
): string[] | undefined {
  if (
    context.route?.tool !== 'projscan_preflight' &&
    !(context.primaryAction && isPreflightAction(context.primaryAction))
  ) {
    return undefined;
  }
  const preflightMode =
    context.route?.tool === 'projscan_preflight' &&
    context.primaryAction?.args &&
    'mode' in context.primaryAction.args
      ? String(context.primaryAction.args.mode)
      : preflightModeForMission(context.mode);
  return [
    `projscan preflight --mode ${preflightMode} returns proceed or only documented manual-review items.`,
    'Every blocker has an owner, linked file, or follow-up command before the developer continues.',
  ];
}
