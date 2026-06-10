import type { MissionOutcome, MissionProofReport, MissionProofTotals } from '../types.js';

export function renderMissionProofMarkdown(report: MissionProofReport): string {
  const totals = report.missionControl.totals;
  const lines: string[] = [
    '# Mission Proof Report',
    '',
    '## Summary',
    `- Mission bundles: ${totals.missions}`,
    `- Passed: ${totals.passed}`,
    `- Failed: ${totals.failed}`,
    `- Running: ${totals.running}`,
    `- Not run: ${totals.notRun}`,
    `- Unavailable: ${totals.unavailable}`,
    `- Proof completion: ${formatPercent(totals.proofCompletionRate)}`,
    `- Reruns: ${totals.reruns}`,
    `- Failed gates: ${totals.failedGates}`,
    `- Reviewer approvals: ${totals.reviewerApprovals}`,
    '',
    report.summary,
    '',
    '## Mission Outcomes',
    '',
  ];

  for (const outcome of report.missionControl.missions) {
    lines.push(...renderMissionOutcome(outcome));
  }

  if (report.baseline && report.comparison) {
    lines.push(...renderBaselineComparison(report.baseline.path, report.baseline.totals, report.comparison));
  }

  lines.push('## Risk Avoided', '');
  for (const item of report.riskAvoided) {
    lines.push(`- ${item}`);
  }
  lines.push('', '## Next Actions', '');
  for (const action of report.nextActions) {
    lines.push(`- ${action.label}`);
    if (action.command) {
      lines.push('', '```bash', action.command, '```', '');
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function renderMissionOutcome(outcome: MissionOutcome): string[] {
  const lines = [
    `### ${outcome.missionDir}`,
    '',
    `- Status: ${outcome.status}`,
    `- Commands: ${outcome.proof.completedCommands} completed, ${outcome.proof.failedCommands} failed, ${outcome.proof.reruns} reruns`,
    `- Version candidate: ${outcome.versionCandidate.recommendation}`,
    `- Changed: ${joinEvidence(outcome.whatChanged)}`,
    `- Remains: ${joinEvidence(outcome.whatRemains)}`,
  ];
  if (!outcome.available && outcome.reason) {
    lines.push(`- Reason: ${outcome.reason}`);
  }
  if (outcome.review.decisions.length > 0) {
    lines.push(`- Reviewer decisions: ${outcome.review.decisions.map((decision) => decision.decision).join(', ')}`);
  }
  lines.push('');
  return lines;
}

function renderBaselineComparison(
  baselinePath: string,
  baselineTotals: MissionProofTotals & { minutesSpent: number },
  comparison: NonNullable<MissionProofReport['comparison']>,
): string[] {
  return [
    '## Baseline Comparison',
    '',
    `- Baseline: ${baselinePath}`,
    `- Baseline runs: ${baselineTotals.missions}`,
    `- Completion delta: ${comparison.completionRateDelta}`,
    `- Reruns avoided: ${comparison.rerunsAvoided}`,
    `- Failed gates avoided: ${comparison.failedGatesAvoided}`,
    `- Minutes saved: ${comparison.minutesSaved}`,
    '',
  ];
}

function joinEvidence(values: string[]): string {
  return values.length > 0 ? values.join('; ') : 'None recorded.';
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
