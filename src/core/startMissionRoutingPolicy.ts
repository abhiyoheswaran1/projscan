import { actionPlanFromRoute } from './startRouteActions.js';
import { actionFromWorkplan } from './startSuccessCriteria.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type {
  StartReport,
  StartRoutedIntent,
  StartWorkflowRecommendation,
} from '../types/start.js';
import type { WorkplanMode, WorkplanReport } from '../types/workplan.js';

export function routedWhyNow(
  route: StartRoutedIntent,
  actionPlan: PreflightSuggestedAction[],
): string {
  if (route.tool === 'projscan_impact' && actionPlan[0]?.tool === 'projscan_search') {
    return `Intent matched "${route.intent}", but the target is a phrase, so search first and then run ${route.tool} on the exact symbol or file.`;
  }
  if (route.tool === 'projscan_fix_suggest' && actionPlan[0]?.tool === 'projscan_doctor') {
    return `Intent matched "${route.intent}", but no issue id was named, so run projscan_doctor first and then run ${route.tool} on the selected issue.`;
  }
  if (route.tool === 'projscan_explain_issue' && actionPlan[0]?.tool === 'projscan_doctor') {
    return `Intent matched "${route.intent}", but no issue id was named, so run projscan_doctor first and then run ${route.tool} on the selected issue.`;
  }
  if (route.tool === 'projscan_upgrade' && actionPlan[0]?.tool === 'projscan_outdated') {
    return `Intent matched "${route.intent}", but no package was named, so run projscan_outdated first and then run ${route.tool} on the selected package.`;
  }
  if (actionPlan[0]?.tool && actionPlan[0].tool !== route.tool) {
    return `Intent matched "${route.intent}", so start with ${actionPlan[0].tool} and then keep ${route.tool} as proof.`;
  }
  return `Intent matched "${route.intent}", so start with ${route.tool} before broader workflow commands.`;
}

export function missionActionPlan(
  mode: WorkplanMode,
  intent: string | undefined,
  route: StartRoutedIntent | undefined,
  fixFirst: StartReport['fixFirst'],
  workplan: WorkplanReport,
  workflow: StartWorkflowRecommendation,
): PreflightSuggestedAction[] {
  if (route?.tool === 'projscan_release_train' && mode !== 'release') {
    return [
      {
        label: `Use projscan_workplan for ${intent ?? mode}`,
        command: `projscan workplan --mode ${mode} --format json`,
        tool: 'projscan_workplan',
        args: { mode },
      },
    ];
  }
  if (route?.tool === 'projscan_preflight' && intent && isDailySafeCommitIntent(mode, intent)) {
    return [
      {
        label: 'Assess safe-commit risk first',
        command: 'projscan assess --mode fix-first --format json',
        tool: 'projscan_assess',
        args: { mode: 'fix-first' },
      },
    ];
  }
  if (route && intent) return actionPlanFromRoute(mode, intent, route);
  const fallback =
    actionFromFixFirst(fixFirst) ?? actionFromWorkplan(workplan) ?? actionFromWorkflow(workflow);
  return [fallback];
}

export function actionFromWorkflow(
  workflow: StartWorkflowRecommendation,
): PreflightSuggestedAction {
  return {
    label: `Run ${workflow.name}`,
    command: workflow.commands[0] ?? 'projscan start --format json',
    tool: workflow.mcpTools[0],
  };
}

function isDailySafeCommitIntent(mode: WorkplanMode, intent: string): boolean {
  return (
    mode === 'before_commit' &&
    /\b(?:safe|safety|ready)\b/i.test(intent) &&
    /\b(?:commit|committing|committed|pr|pull\s+request)\b/i.test(intent)
  );
}

function actionFromFixFirst(
  fixFirst: StartReport['fixFirst'],
): PreflightSuggestedAction | undefined {
  if (!fixFirst) return undefined;
  return {
    label: fixFirst.title,
    command: fixFirst.commands[0],
  };
}
