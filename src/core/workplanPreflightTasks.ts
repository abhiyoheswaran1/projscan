import type {
  PreflightReason,
  WorkplanEvidence,
  WorkplanPriority,
  WorkplanTask,
} from '../types.js';

const HANDOFF_LIMIT = 320;

export function tasksFromPreflight(reasons: PreflightReason[]): WorkplanTask[] {
  const tasks: WorkplanTask[] = [];

  const supplyChain = reasons.filter((reason) => reason.source === 'supply-chain');
  if (supplyChain.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-supply-chain-1',
        priority: supplyChain.some((reason) => reason.severity === 'error') ? 'p0' : 'p1',
        title: 'Resolve supply-chain trust blockers',
        why: 'Supply-chain findings can mean install-time compromise, unsafe dependency provenance, or hidden persistence hooks. Handle these before continuing with normal product work.',
        evidence: supplyChain.map(reasonToEvidence),
        files: filesFromReasons(supplyChain),
        suggestedTools: ['projscan_doctor', 'projscan_preflight'],
        commands: ['projscan preflight --format json', 'projscan doctor --format json'],
        expected:
          'No supply-chain errors remain, and preflight no longer blocks on supply-chain evidence.',
      }),
    );
  }

  const review = reasons.filter(
    (reason) => reason.source === 'review' || reason.source === 'taint',
  );
  if (review.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-review-gate',
        priority: review.some((reason) => reason.severity === 'error') ? 'p0' : 'p1',
        title: 'Inspect review and dataflow blockers',
        why: 'Review, taint, and dataflow findings describe merge safety, new risky flows, and structural changes that need explicit handling before handoff.',
        evidence: review.map(reasonToEvidence),
        files: filesFromReasons(review),
        suggestedTools: [
          'projscan_review',
          'projscan_semantic_graph',
          'projscan_taint',
          'projscan_dataflow',
        ],
        commands: [
          'projscan review --format json',
          'projscan semantic-graph --format json',
          'projscan dataflow --format json',
          'projscan preflight --mode before_merge --format json',
        ],
        expected:
          'The review verdict is ok or the remaining review items are intentionally documented.',
      }),
    );
  }

  const doctor = reasons.filter(
    (reason) => reason.source === 'doctor' || reason.source === 'plugin',
  );
  if (doctor.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-health-policy',
        priority: doctor.some((reason) => reason.severity === 'error') ? 'p0' : 'p1',
        title: 'Fix health and plugin-policy findings',
        why: 'Health and local policy findings are the fastest path from diagnosis to concrete fixes because they point at files, issue ids, and existing fix suggestions.',
        evidence: doctor.map(reasonToEvidence),
        files: filesFromReasons(doctor),
        suggestedTools: ['projscan_doctor', 'projscan_fix_suggest'],
        commands: ['projscan doctor --format json', 'npm test'],
        expected:
          'The relevant issue ids disappear from projscan doctor and the focused test command passes.',
      }),
    );
  }

  const hotspots = reasons.filter((reason) => reason.source === 'hotspots');
  if (hotspots.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-touched-hotspots',
        priority: 'p1',
        title: 'Review touched high-risk hotspots',
        why: 'Touched hotspots combine churn, complexity, and issue density. They are where small mistakes most often become expensive regressions.',
        evidence: hotspots.map(reasonToEvidence),
        files: filesFromReasons(hotspots),
        suggestedTools: ['projscan_hotspots', 'projscan_file'],
        commands: ['projscan hotspots --format json', 'projscan file <path> --format json'],
        expected:
          'The touched hotspot has a clear owner, test target, and reduced or accepted risk.',
      }),
    );
  }

  const changed = reasons.filter(
    (reason) => reason.source === 'changed-files' || reason.source === 'git',
  );
  if (changed.length > 0) {
    tasks.push(
      makeTask({
        id: 'wp-git-scope',
        priority: 'p1',
        title: 'Stabilize git scope for review',
        why: 'A workplan is only useful when changed-file and base-ref evidence are reliable. Pin the base ref before trusting merge decisions.',
        evidence: changed.map(reasonToEvidence),
        files: [],
        suggestedTools: ['projscan_preflight', 'projscan_review'],
        commands: ['projscan preflight --base-ref main --format json'],
        expected:
          'Changed-file evidence is available and review can compare the intended base/head refs.',
      }),
    );
  }

  return tasks;
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

function filesFromReasons(reasons: PreflightReason[]): string[] {
  return unique(
    reasons.map((reason) => reason.file).filter((file): file is string => typeof file === 'string'),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`;
}
