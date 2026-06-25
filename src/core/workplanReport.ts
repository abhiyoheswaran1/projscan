import type {
  PreflightVerdict,
  WorkplanEvidence,
  WorkplanHandoffPayload,
  WorkplanMode,
  WorkplanPriority,
  WorkplanReport,
  WorkplanTask,
  WorkplanTopRisk,
} from '../types.js';

export function buildWorkplanHandoffPayload(report: WorkplanReport): WorkplanHandoffPayload {
  const next = report.tasks.slice(0, 5).map((task) => task.handoffText);
  const verificationCommands = unique(
    report.tasks.flatMap((task) => task.verification.commands),
  ).slice(0, 12);
  return {
    summary: report.summary,
    verdict: report.verdict,
    mode: report.mode,
    next,
    verificationCommands,
    coordination: report.coordination,
    markdown: renderWorkplanHandoffMarkdown(report, next, verificationCommands),
  };
}

function renderWorkplanHandoffMarkdown(
  report: WorkplanReport,
  next: string[],
  verificationCommands: string[],
): string {
  const lines = [
    '# Agent Handoff',
    '',
    `**Mode:** ${report.mode}`,
    `**Verdict:** ${report.verdict}`,
    '',
    report.summary,
    '',
    '## Next',
    ...(next.length > 0 ? next.map((item) => `- ${item}`) : ['- Preserve the current baseline.']),
    '',
    '## Verification',
    ...(verificationCommands.length > 0
      ? verificationCommands.map((command) => `- \`${command}\``)
      : ['- `projscan preflight --format json`']),
    '',
    '## Coordination',
    `- ${report.coordination.recommendedNextAgent}`,
    ...report.coordination.touchedFiles.slice(0, 10).map((file) => `- touched: ${file}`),
  ];
  return `${lines.join('\n')}\n`;
}

export function rankWorkplanTasks(tasks: WorkplanTask[]): WorkplanTask[] {
  const seen = new Set<string>();
  return tasks
    .filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    })
    .sort((a, b) => {
      const priority = priorityRank(a.priority) - priorityRank(b.priority);
      if (priority !== 0) return priority;
      const evidence = strongestEvidenceRank(a.evidence) - strongestEvidenceRank(b.evidence);
      if (evidence !== 0) return evidence;
      return a.id.localeCompare(b.id);
    });
}

function strongestEvidenceRank(evidence: WorkplanEvidence[]): number {
  if (evidence.some((item) => item.severity === 'error')) return 0;
  if (evidence.some((item) => item.severity === 'warning')) return 1;
  return 2;
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

export function summarizeWorkplan(
  mode: WorkplanMode,
  verdict: PreflightVerdict,
  tasks: WorkplanTask[],
  risks: WorkplanTopRisk[],
): string {
  if (tasks.length === 0) return `${verdict}: ${mode} workplan has no recommended tasks`;
  const riskText = risks.length > 0 ? `${risks.length} top risk(s)` : 'no top risks';
  return `${verdict}: ${mode} workplan has ${tasks.length} task(s), starting with ${tasks[0]?.title}; ${riskText}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
