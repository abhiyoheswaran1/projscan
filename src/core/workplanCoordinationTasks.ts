import type {
  PreflightVerdict,
  SessionConflict,
  WorkplanCoordination,
  WorkplanEvidence,
  WorkplanPriority,
  WorkplanTask,
} from '../types.js';

const MAX_COORDINATION_FILES = 20;
const HANDOFF_LIMIT = 320;

export function buildCoordination(
  verdict: PreflightVerdict,
  touchedFiles: string[],
  conflicts: SessionConflict[],
): WorkplanCoordination {
  const visibleTouched = touchedFiles.slice(0, MAX_COORDINATION_FILES);
  let recommendedNextAgent = 'preflight agent: run the safety gate, then pick the first p0/p1 task';
  if (verdict === 'block') {
    recommendedNextAgent = 'hardening agent: resolve p0 blockers before feature work continues';
  } else if (conflicts.length > 0) {
    recommendedNextAgent =
      'coordination agent: inspect touched-file overlap before parallel edits continue';
  } else if (visibleTouched.length > 0) {
    recommendedNextAgent =
      'handoff/preflight agent: continue from touched-file context, then confirm the safety gate before editing';
  }
  return {
    touchedFiles: visibleTouched,
    conflicts,
    recommendedNextAgent,
  };
}

export function tasksFromCoordination(coordination: WorkplanCoordination): WorkplanTask[] {
  if (coordination.touchedFiles.length === 0 && coordination.conflicts.length === 0) return [];
  const evidence: WorkplanEvidence[] = [
    ...coordination.touchedFiles.slice(0, 5).map((file) => ({
      source: 'coordination' as const,
      file,
      message: `session touched ${file}`,
    })),
    ...coordination.conflicts.map((conflict) => ({
      source: 'coordination' as const,
      severity: conflict.severity,
      file: conflict.files[0],
      message: conflict.message,
    })),
  ];
  return [
    makeTask({
      id: 'wp-session-handoff',
      priority: coordination.conflicts.some((conflict) => conflict.severity === 'error')
        ? 'p0'
        : 'p1',
      title: 'Coordinate touched files before parallel work continues',
      why: 'Session evidence tells the next agent what changed recently and which files may collide across agents.',
      evidence,
      files: coordination.touchedFiles,
      suggestedTools: ['projscan_session', 'projscan://handoff', 'projscan://risk-now'],
      commands: ['projscan session touched --format json', 'projscan handoff'],
      expected:
        'The next agent can name touched files, current overlap risks, and the first safe task.',
    }),
  ];
}

function makeTask(input: {
  id: string;
  priority: WorkplanPriority;
  title: string;
  why: string;
  evidence: WorkplanEvidence[];
  files: string[];
  suggestedTools: string[];
  commands: string[];
  expected: string;
}): WorkplanTask {
  const files = unique(input.files.filter(Boolean)).slice(0, 12);
  const handoffText = compact(
    `${input.priority.toUpperCase()} ${input.title}: ${input.why} Verify with ${input.commands.join(' && ')}.${files.length > 0 ? ` Files: ${files.join(', ')}.` : ''}`,
    HANDOFF_LIMIT,
  );
  return {
    id: input.id,
    priority: input.priority,
    title: input.title,
    why: input.why,
    evidence: input.evidence,
    files,
    suggestedTools: unique(input.suggestedTools),
    verification: {
      commands: input.commands,
      expected: input.expected,
    },
    handoffText,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`;
}
