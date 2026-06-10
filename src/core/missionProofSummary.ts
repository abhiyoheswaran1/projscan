import type { MissionProofReport, MissionProofTotals } from '../types.js';

export function renderMissionProofSummary(report: MissionProofReport): string {
  const totals = report.missionControl.totals;
  const status = totals.missions > 0 && totals.passed === totals.missions ? 'PASS' : 'FAIL';
  return `Mission proof: ${status} (${summarizeTotals(totals)}).`;
}

function summarizeTotals(totals: MissionProofTotals): string {
  const details = [
    `${totals.passed} of ${totals.missions} passed`,
    totals.failed > 0 ? `${totals.failed} failed` : undefined,
    totals.running > 0 ? `${totals.running} running` : undefined,
    totals.notRun > 0 ? `${totals.notRun} not run` : undefined,
    totals.unavailable > 0 ? `${totals.unavailable} unavailable` : undefined,
  ].filter(Boolean);
  return details.join('; ');
}
