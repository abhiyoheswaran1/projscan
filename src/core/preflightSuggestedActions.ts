import type {
  PreflightMode,
  PreflightReason,
  PreflightSuggestedAction,
} from '../types.js';

interface ChangedFilesEvidence {
  available: boolean;
}

export function buildSuggestedActions(input: {
  reasons: PreflightReason[];
  mode: PreflightMode;
  changedFiles: ChangedFilesEvidence;
}): PreflightSuggestedAction[] {
  if (input.reasons.length === 0) return [];
  return dedupeActions(actionsForReasons(input));
}

export function buildToolCalls(input: {
  reasons: PreflightReason[];
  mode: PreflightMode;
  changedFiles: ChangedFilesEvidence;
}): PreflightSuggestedAction[] {
  return buildSuggestedActions(input).map(toToolCallAction);
}

function actionsForReasons(input: {
  reasons: PreflightReason[];
  mode: PreflightMode;
  changedFiles: ChangedFilesEvidence;
}): PreflightSuggestedAction[] {
  return [
    reviewActionForReasons(input.reasons),
    healthPolicyActionForReasons(input.reasons),
    sessionActionForReasons(input.reasons),
    explicitBaseActionForState(input.mode, input.changedFiles),
  ].filter((action): action is PreflightSuggestedAction => Boolean(action));
}

function hasAnyReasonSource(reasons: PreflightReason[], sources: string[]): boolean {
  const sourceSet = new Set(sources);
  return reasons.some((reason) => sourceSet.has(reason.source));
}

function shouldSuggestExplicitBase(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
): boolean {
  return mode !== 'before_edit' && !changedFiles.available;
}

function reviewActionForReasons(reasons: PreflightReason[]): PreflightSuggestedAction | undefined {
  return hasAnyReasonSource(reasons, ['review', 'taint']) ? reviewAction() : undefined;
}

function healthPolicyActionForReasons(
  reasons: PreflightReason[],
): PreflightSuggestedAction | undefined {
  return hasAnyReasonSource(reasons, ['doctor', 'plugin', 'supply-chain'])
    ? healthPolicyAction()
    : undefined;
}

function sessionActionForReasons(reasons: PreflightReason[]): PreflightSuggestedAction | undefined {
  return hasAnyReasonSource(reasons, ['hotspots', 'session']) ? sessionAction() : undefined;
}

function explicitBaseActionForState(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
): PreflightSuggestedAction | undefined {
  return shouldSuggestExplicitBase(mode, changedFiles) ? explicitBaseAction() : undefined;
}

function reviewAction(): PreflightSuggestedAction {
  return {
    label: 'Inspect the full review before continuing',
    command: 'projscan review --format json',
    tool: 'projscan_review',
  };
}

function healthPolicyAction(): PreflightSuggestedAction {
  return {
    label: 'Inspect health, plugin policy, and supply-chain findings',
    command: 'projscan doctor --format json',
    tool: 'projscan_doctor',
  };
}

function sessionAction(): PreflightSuggestedAction {
  return {
    label: 'Inspect remembered session hotspots',
    command: 'projscan session touched --format json',
    tool: 'projscan_session',
  };
}

function explicitBaseAction(): PreflightSuggestedAction {
  return {
    label: 'Run preflight with an explicit base ref',
    command: 'projscan preflight --base-ref main --format json',
  };
}

function toToolCallAction(action: PreflightSuggestedAction): PreflightSuggestedAction {
  return {
    label: action.label,
    ...(action.tool ? { tool: action.tool } : {}),
    ...(action.args ? { args: action.args } : {}),
  };
}

function dedupeActions(actions: PreflightSuggestedAction[]): PreflightSuggestedAction[] {
  const seen = new Set<string>();
  const out: PreflightSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.label}:${action.command ?? action.tool ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}
