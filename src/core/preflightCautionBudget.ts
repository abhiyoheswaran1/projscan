import type {
  PreflightCautionAction,
  PreflightCautionBudget,
  PreflightCautionBudgetItem,
  PreflightReason,
  PreflightReasonSource,
} from '../types.js';

const MANUAL_SIGNOFF_SOURCES = new Set<PreflightReasonSource>([
  'release',
  'changed-files',
  'hotspots',
  'session',
  'coordination',
]);

export function buildCautionBudget(reasons: PreflightReason[]): PreflightCautionBudget | undefined {
  const items = reasons.filter((reason) => reason.severity === 'warning').map(toBudgetItem);
  if (items.length === 0) return undefined;

  const primary = [...items].sort(compareBudgetPriority)[0];
  return {
    primary,
    reviewOnly: items.filter((item) => item !== primary),
    fixNow: items.filter((item) => item.action === 'fix_now'),
    manualSignoff: items.filter((item) => item.action === 'manual_signoff'),
  };
}

function toBudgetItem(reason: PreflightReason): PreflightCautionBudgetItem {
  const action = actionForReason(reason);
  return {
    severity: reason.severity,
    source: reason.source,
    message: reason.message,
    action,
    ...(reason.file ? { file: reason.file } : {}),
    ...(reason.issueId ? { issueId: reason.issueId } : {}),
    ...(reason.tool ? { tool: reason.tool } : {}),
    command: commandForReason(reason, action),
  };
}

function actionForReason(reason: PreflightReason): PreflightCautionAction {
  if (MANUAL_SIGNOFF_SOURCES.has(reason.source)) return 'manual_signoff';
  if (reason.source === 'review' && isScaleOnlyReview(reason.message)) return 'manual_signoff';
  return 'fix_now';
}

function compareBudgetPriority(
  a: PreflightCautionBudgetItem,
  b: PreflightCautionBudgetItem,
): number {
  const actionDelta = actionRank(a.action) - actionRank(b.action);
  if (actionDelta !== 0) return actionDelta;
  return sourceRank(a.source) - sourceRank(b.source);
}

function actionRank(action: PreflightCautionAction): number {
  return action === 'fix_now' ? 0 : 1;
}

function sourceRank(source: PreflightReasonSource): number {
  switch (source) {
    case 'doctor':
    case 'taint':
    case 'plugin':
    case 'supply-chain':
      return 0;
    case 'review':
      return 1;
    case 'release':
      return 2;
    default:
      return 3;
  }
}

function commandForReason(reason: PreflightReason, action: PreflightCautionAction): string {
  if (reason.tool === 'projscan_review') return 'projscan review --format json';
  if (reason.tool === 'projscan_doctor') return 'projscan doctor --format json';
  if (reason.tool === 'projscan_dataflow') return 'projscan dataflow --format json';
  if (reason.tool === 'projscan_plugin') return 'projscan plugin list --format json';
  if (reason.source === 'supply-chain') return 'projscan audit --format json';
  if (action === 'manual_signoff') return 'projscan preflight --mode before_commit --format json';
  return 'projscan doctor --format json';
}

function isScaleOnlyReview(message: string): boolean {
  return (
    message.includes('scale/complexity') &&
    !message.includes('new import cycle') &&
    !message.includes('taint') &&
    !message.includes('dataflow')
  );
}
