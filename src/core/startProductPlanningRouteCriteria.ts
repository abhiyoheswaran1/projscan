import type { StartRoutedIntent } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

export interface ProductPlanningSuccessCriteriaInput {
  mode: WorkplanMode;
  route?: StartRoutedIntent;
}

export function isProductPlanningWorkplanRoute(route: StartRoutedIntent | undefined): boolean {
  if (route?.tool !== 'projscan_workplan' || route.confidence !== 'high') return false;
  const keywords = new Set(route.matchedKeywords);
  const planningSignal = [
    'next',
    'plan',
    'workplan',
    'tasks',
    'to' + 'do',
    'prioritize',
    'priorities',
    'roadmap',
    'strategy',
    'strategic',
  ].some((keyword) => keywords.has(keyword));
  const productSignal = ['product', 'products', 'feature', 'features', 'strategy', 'strategic'].some(
    (keyword) => keywords.has(keyword),
  );
  return planningSignal && productSignal;
}

export function productPlanningSuccessCriteria(
  context: ProductPlanningSuccessCriteriaInput,
): string[] | undefined {
  if (context.mode !== 'bug_hunt' || !isProductPlanningWorkplanRoute(context.route))
    return undefined;
  return [
    'A prioritized product-planning slice is selected from the bug-hunt workplan with a clear accept, defer, or split decision.',
    'The selected slice has a runnable verification command before implementation starts.',
    'Deferred product ideas have an explicit reason or follow-up instead of staying in the active workplan.',
  ];
}
