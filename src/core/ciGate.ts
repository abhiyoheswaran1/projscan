import type { Issue, HealthScore, IssueSeverity } from '../types.js';
import type { CiFailOnSeverity } from '../types/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import { DEFAULT_CI_FAIL_ON } from '../utils/ciFailOn.js';

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

export interface CiGateResult extends HealthScore {
  threshold: number;
  pass: boolean;
  scorePass: boolean;
  failOn: CiFailOnSeverity;
  severityFloorMet: boolean;
}

export function evaluateCiGate(
  issues: Issue[],
  threshold: number,
  failOn: CiFailOnSeverity = DEFAULT_CI_FAIL_ON,
): CiGateResult {
  const health = calculateScore(issues);
  const scorePass = health.score >= threshold;
  const severityFloorMet = issues.some(
    (issue) => SEVERITY_RANK[issue.severity] >= SEVERITY_RANK[failOn],
  );
  return {
    ...health,
    threshold,
    pass: scorePass || !severityFloorMet,
    scorePass,
    failOn,
    severityFloorMet,
  };
}
