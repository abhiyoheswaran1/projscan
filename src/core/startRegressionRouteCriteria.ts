import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { RegressionPlanLevel } from '../types/regressionPlan.js';
import type { StartRoutedIntent } from '../types/start.js';

export function regressionSuccessCriteria(
  primaryAction: PreflightSuggestedAction | undefined,
  route?: StartRoutedIntent,
): string[] {
  const level = regressionLevelFromPrimaryAction(primaryAction);
  return [
    regressionPlanCriterion(level, route),
    'projscan ci --changed-only or the matching test command is rerun after the selected fix.',
  ];
}

function regressionLevelFromPrimaryAction(
  primaryAction: PreflightSuggestedAction | undefined,
): RegressionPlanLevel {
  const level =
    primaryAction?.args && 'level' in primaryAction.args
      ? String(primaryAction.args.level)
      : 'focused';
  if (level === 'smoke' || level === 'focused' || level === 'full') return level;
  return 'focused';
}

function regressionPlanCriterion(level: RegressionPlanLevel, route?: StartRoutedIntent): string {
  if (level === 'smoke')
    return 'The smoke regression plan identifies the smallest health and preflight commands to rerun.';
  if (level === 'full')
    return 'The full regression plan identifies release-grade build, lint, stability, and test commands to rerun.';
  if (
    route &&
    route.matchedKeywords.some((keyword) =>
      [
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
        '500',
        '502',
        '503',
        '504',
        '404',
        '403',
        '401',
      ].includes(keyword),
    )
  ) {
    return 'The focused regression plan identifies the smallest high-signal commands to reproduce and verify the failure.';
  }
  if (
    route &&
    route.matchedKeywords.some((keyword) =>
      [
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
      ].includes(keyword),
    )
  ) {
    return 'The focused regression plan identifies the local setup command, environment symptom, and smallest rerun proof for the blocker.';
  }
  return 'The focused regression plan identifies the failing CI or test signal and the smallest verification command to rerun.';
}
