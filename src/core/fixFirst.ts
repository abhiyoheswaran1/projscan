import type {
  BugHuntFinding,
  EvidencePackTopRisk,
  FixFirstRecommendation,
  QualityScorecardRisk,
  StartRisk,
  WorkplanTask,
  WorkplanTopRisk,
} from '../types.js';

export function fixFirstFromBugHuntFinding(finding: BugHuntFinding | undefined): FixFirstRecommendation | undefined {
  if (!finding) return undefined;
  return {
    id: finding.id,
    title: finding.title,
    source: finding.source,
    priority: finding.priority,
    whyFirst: whyFirst(finding.priority, finding.source, finding.why),
    files: finding.files,
    commands: finding.verification.commands,
    expected: finding.verification.expected,
  };
}

export function fixFirstFromWorkplanTask(task: WorkplanTask | undefined): FixFirstRecommendation | undefined {
  if (!task) return undefined;
  return {
    id: task.id,
    title: task.title,
    source: task.evidence[0]?.source ?? 'workplan',
    priority: task.priority,
    whyFirst: whyFirst(task.priority, task.evidence[0]?.source ?? 'workplan', task.why),
    files: task.files,
    ...(task.owner ? { owner: task.owner } : {}),
    commands: task.verification.commands,
    expected: task.verification.expected,
  };
}

export function fixFirstFromWorkplanRisk(risk: WorkplanTopRisk | undefined): FixFirstRecommendation | undefined {
  if (!risk) return undefined;
  return {
    id: `risk-${slug(risk.source)}-${slug(risk.file ?? risk.message)}`,
    title: risk.message,
    source: risk.source,
    priority: risk.priority,
    whyFirst: whyFirst(risk.priority, risk.source, risk.message),
    files: risk.file ? [risk.file] : [],
    ...(risk.owner ? { owner: risk.owner } : {}),
    commands: [risk.tool === 'projscan_review' ? 'projscan review --format json' : 'projscan preflight --format json'],
  };
}

export function fixFirstFromQualityRisk(risk: QualityScorecardRisk | undefined): FixFirstRecommendation | undefined {
  if (!risk) return undefined;
  return {
    id: risk.id,
    title: risk.title,
    source: risk.source,
    priority: risk.priority,
    whyFirst: whyFirst(risk.priority, risk.source, risk.title),
    files: risk.files,
    commands: [risk.command],
  };
}

export function fixFirstFromStartRisk(risk: StartRisk | undefined): FixFirstRecommendation | undefined {
  if (!risk) return undefined;
  return {
    id: risk.id,
    title: risk.title,
    source: risk.source,
    priority: risk.priority,
    whyFirst: whyFirst(risk.priority, risk.source, risk.title),
    files: risk.files,
    commands: [risk.command],
  };
}

export function fixFirstFromEvidenceRisk(risk: EvidencePackTopRisk | undefined): FixFirstRecommendation | undefined {
  if (!risk) return undefined;
  return {
    id: `pr-risk-${slug(risk.title)}`,
    title: risk.title,
    source: 'pr-risk',
    priority: risk.priority,
    whyFirst: whyFirst(risk.priority, 'PR evidence', risk.title),
    files: risk.files,
    ...(risk.owner ? { owner: risk.owner } : {}),
    commands: [risk.command],
  };
}

export function fixFirstFromChangedFiles(files: string[], owner?: string): FixFirstRecommendation | undefined {
  if (files.length === 0) return undefined;
  return {
    id: 'pr-owned-change-review',
    title: owner ? `Review changed files owned by ${owner}` : 'Review changed files before approval',
    source: 'changed-files',
    priority: 'p2',
    whyFirst: 'First because the PR changed explicitly owned files, so reviewer routing should happen before approval.',
    files: files.slice(0, 5),
    ...(owner ? { owner } : {}),
    commands: ['projscan review --format json', 'projscan preflight --mode before_merge --format json'],
    expected: 'The owning reviewer confirms the change or records the accepted risk.',
  };
}

function whyFirst(priority: string, source: string, detail: string): string {
  if (priority === 'p0') return `First because this is the highest-priority blocking signal from ${source}: ${detail}`;
  if (priority === 'p1') return `First because this is the highest-priority review signal from ${source}: ${detail}`;
  return `First because it is the next useful verification step from ${source}: ${detail}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
}
