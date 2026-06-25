import type { OwnershipLookup } from './ownership.js';
import type {
  PreflightReason,
  SessionConflict,
  WorkplanEvidence,
  WorkplanTask,
  WorkplanTopRisk,
} from '../types.js';

const MAX_TOP_RISKS = 8;
const HANDOFF_LIMIT = 320;

export function buildTopRisks(
  reasons: PreflightReason[],
  conflicts: SessionConflict[],
  extraRisks: WorkplanTopRisk[] = [],
): WorkplanTopRisk[] {
  const reasonRisks = reasons.map((reason) => ({
    ...reasonToEvidence(reason),
    priority: reason.severity === 'error' ? ('p0' as const) : ('p1' as const),
  }));
  const conflictRisks = conflicts.map((conflict) => ({
    source: 'coordination' as const,
    message: conflict.message,
    severity: conflict.severity,
    file: conflict.files[0],
    priority: conflict.severity === 'error' ? ('p0' as const) : ('p1' as const),
  }));
  const seen = new Set<string>();
  return [...reasonRisks, ...conflictRisks, ...extraRisks]
    .map((risk, index) => ({ risk, index }))
    .filter((entry) => {
      const { risk } = entry;
      const key = `${risk.source}:${risk.file ?? ''}:${risk.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const priority = priorityRank(a.risk.priority) - priorityRank(b.risk.priority);
      if (priority !== 0) return priority;
      return a.index - b.index;
    })
    .map((entry) => entry.risk)
    .slice(0, MAX_TOP_RISKS);
}

export function annotateTasksWithOwners(
  tasks: WorkplanTask[],
  ownership: OwnershipLookup | undefined,
): WorkplanTask[] {
  if (!ownership) return tasks;
  return tasks.map((task) => {
    const owner = ownerForTask(task, ownership);
    if (!owner) return task;
    return {
      ...task,
      owner,
      handoffText: compact(`${task.handoffText} Owner: ${owner}.`, HANDOFF_LIMIT),
    };
  });
}

export function annotateTopRisksWithOwners(
  risks: WorkplanTopRisk[],
  ownership: OwnershipLookup | undefined,
): WorkplanTopRisk[] {
  if (!ownership) return risks;
  return risks.map((risk) => {
    const owner = ownerForFiles(
      [risk.file].filter((file): file is string => typeof file === 'string'),
      ownership,
    );
    return owner ? { ...risk, owner } : risk;
  });
}

function reasonToEvidence(reason: PreflightReason): WorkplanEvidence {
  return {
    source: reason.source,
    message: reason.message,
    severity: reason.severity,
    ...(reason.file ? { file: reason.file } : {}),
    ...(reason.issueId ? { issueId: reason.issueId } : {}),
    ...(reason.tool ? { tool: reason.tool } : {}),
  };
}

function ownerForTask(task: WorkplanTask, ownership: OwnershipLookup): string | undefined {
  const evidenceFiles = task.evidence
    .map((item) => item.file)
    .filter((file): file is string => typeof file === 'string' && file.length > 0);
  return ownerForFiles([...task.files, ...evidenceFiles], ownership);
}

function ownerForFiles(files: string[], ownership: OwnershipLookup): string | undefined {
  for (const file of unique(files)) {
    const owner = ownership(file);
    if (owner) return owner;
  }
  return undefined;
}

function priorityRank(priority: WorkplanTopRisk['priority']): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`;
}
