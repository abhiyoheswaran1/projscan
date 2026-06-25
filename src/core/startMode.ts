import {
  inferModeFromStartRoutes,
  routesForStartIntent,
} from './startModeRoutingPolicy.js';
import { isWorkplanMode } from './workplan.js';
import type { StartModeSource, StartRoutedIntent } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

export { hasProhibitedWorkflowModeAction, preflightModeFromIntent } from './startModeIntentPolicy.js';

export interface StartModeResolution {
  mode: WorkplanMode;
  source: StartModeSource;
  reason: string;
}

export type StartModeInput = WorkplanMode | 'before_handoff';

export function resolveStartMode(
  value: StartModeInput | undefined,
  intent: string | undefined,
): StartModeResolution {
  const explicitMode = typeof value === 'string' ? normalizeStartModeInput(value) : undefined;
  if (explicitMode) {
    return {
      mode: explicitMode,
      source: 'explicit',
      reason:
        explicitMode === value
          ? `Mode ${value} was provided explicitly.`
          : `Mode ${value} was provided explicitly and maps to ${explicitMode}.`,
    };
  }
  const inferred = inferModeFromIntent(intent);
  if (inferred) {
    return {
      mode: inferred,
      source: 'intent',
      reason: `Intent "${intent}" maps to the ${inferred} workflow.`,
    };
  }
  return {
    mode: 'before_edit',
    source: 'default',
    reason: defaultModeReason(intent, routesForIntent(intent).length > 0),
  };
}

export function isStartModeInput(value: string): value is StartModeInput {
  return normalizeStartModeInput(value) !== undefined;
}

function normalizeStartModeInput(value: string): WorkplanMode | undefined {
  if (value === 'before_handoff') return 'before_commit';
  return isWorkplanMode(value) ? value : undefined;
}

export function inferModeFromIntent(intent: string | undefined): WorkplanMode | undefined {
  return inferModeFromStartRoutes(intent);
}

export function routesForIntent(intent: string | undefined): StartRoutedIntent[] {
  return routesForStartIntent(intent);
}

function defaultModeReason(intent: string | undefined, routed: boolean): string {
  if (!intent)
    return 'No mode-specific intent or explicit mode was supplied, so start defaults to before_edit.';
  if (routed) {
    return `Mission Control routed the intent, but no workflow-mode hint matched "${intent}", so start defaults to before_edit.`;
  }
  return `No mode-specific intent matched "${intent}", so start defaults to before_edit.`;
}
