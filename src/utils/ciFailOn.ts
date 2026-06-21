import type { CiFailOnSeverity } from '../types/config.js';

export const DEFAULT_CI_FAIL_ON: CiFailOnSeverity = 'warning';
export const CI_FAIL_ON_VALUES: CiFailOnSeverity[] = ['info', 'warning', 'error'];

export function normalizeCiFailOn(value: unknown): CiFailOnSeverity | undefined {
  return typeof value === 'string' && isCiFailOnSeverity(value) ? value : undefined;
}

export function ciFailOnLabel(failOn: CiFailOnSeverity): string {
  return `${failOn}-or-higher`;
}

function isCiFailOnSeverity(value: string): value is CiFailOnSeverity {
  return CI_FAIL_ON_VALUES.includes(value as CiFailOnSeverity);
}
