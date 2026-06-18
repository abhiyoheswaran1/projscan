import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { StartRoutedIntent } from '../types/start.js';

export interface ImpactSuccessCriteriaInput {
  route?: StartRoutedIntent;
  primaryAction?: PreflightSuggestedAction;
}

export function impactSuccessCriteria(
  context: ImpactSuccessCriteriaInput,
): string[] | undefined {
  if (context.route?.tool !== 'projscan_impact') return undefined;
  return [
    ...(context.primaryAction?.tool === 'projscan_search'
      ? [
          'An exact symbol or file path is selected from search results before impact analysis continues.',
        ]
      : []),
    'The impact report is reviewed for direct and transitive dependents before editing starts.',
    'Affected call sites, tests, or owners are added to the workplan before code changes begin.',
  ];
}
