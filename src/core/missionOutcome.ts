import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  MissionOutcome,
  MissionProofStatusRow,
  MissionReviewDecisionRecord,
  MissionRunStatus,
} from '../types/start.js';

interface RawMissionSummary {
  status?: unknown;
  nextAction?: unknown;
  totalCommands?: unknown;
  failedStep?: unknown;
  exitCode?: unknown;
  log?: unknown;
}

export async function loadMissionOutcome(
  rootPath: string,
  missionDir: string,
): Promise<MissionOutcome> {
  const resolved = path.resolve(rootPath, missionDir);
  const relativeMissionDir = path.relative(rootPath, resolved) || '.';
  try {
    const [summary, rows, decisions] = await Promise.all([
      readJson<RawMissionSummary>(path.join(resolved, 'proof-logs', 'summary.json')),
      readJsonl<MissionProofStatusRow>(path.join(resolved, 'proof-logs', 'status.jsonl')),
      readReviewDecisions(resolved),
    ]);
    const status = missionStatus(summary.status);
    const failedRows = rows.filter((row) => typeof row.exitCode === 'number' && row.exitCode !== 0);
    const completedCommands =
      rows.length > 0
        ? rows.length
        : typeof summary.totalCommands === 'number'
          ? summary.totalCommands
          : 0;
    const failedStep = stringValue(summary.failedStep) ?? failedRows[0]?.id;
    const failedLog = stringValue(summary.log) ?? failedRows[0]?.log;
    const proof = {
      completedCommands,
      failedCommands: failedRows.length,
      reruns: countReruns(rows),
      ...(typeof summary.totalCommands === 'number'
        ? { totalCommands: summary.totalCommands }
        : {}),
      ...(failedStep ? { failedStep } : {}),
      ...(failedLog ? { failedLog } : {}),
      ...(typeof summary.exitCode === 'number' ? { exitCode: summary.exitCode } : {}),
      rows,
    };
    const review = summarizeReview(decisions);
    const whatChanged = buildWhatChanged(
      status,
      proof.completedCommands,
      proof.failedCommands,
      proof.reruns,
      failedStep,
    );
    const nextAction = stringValue(summary.nextAction);
    const whatRemains = buildWhatRemains(status, nextAction, failedLog, failedStep);
    const versionCandidate = versionCandidateFor(status, proof.failedCommands);
    const resumePrompt = buildResumePrompt(
      status,
      whatChanged,
      whatRemains,
      versionCandidate.summary,
    );
    return {
      schemaVersion: 1,
      available: true,
      missionDir: relativeMissionDir,
      status,
      ...(nextAction ? { nextAction } : {}),
      proof,
      review,
      whatChanged,
      whatRemains,
      versionCandidate,
      resumePrompt,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return unavailableOutcome(relativeMissionDir, reason);
  }
}

async function readReviewDecisions(missionDir: string): Promise<MissionReviewDecisionRecord[]> {
  const candidates = [
    path.join(missionDir, 'proof-logs', 'review-decisions.jsonl'),
    path.join(missionDir, 'review-decisions.jsonl'),
  ];
  const all: MissionReviewDecisionRecord[] = [];
  for (const candidate of candidates) {
    all.push(...(await readJsonl<MissionReviewDecisionRecord>(candidate)));
  }
  const single = await readJson<MissionReviewDecisionRecord | null>(
    path.join(missionDir, 'review-decision.json'),
  ).catch(() => null);
  if (single && typeof single.decision === 'string') all.push(single);
  return all.filter((record) => typeof record.decision === 'string');
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return [];
  }
  const values: T[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      values.push(JSON.parse(trimmed) as T);
    } catch {
      // Ignore malformed local review/proof rows; the summary still carries the mission state.
    }
  }
  return values;
}

function missionStatus(value: unknown): MissionRunStatus {
  return value === 'not_run' || value === 'running' || value === 'passed' || value === 'failed'
    ? value
    : 'unknown';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function countReruns(rows: MissionProofStatusRow[]): number {
  const seen = new Set<string>();
  let reruns = 0;
  for (const row of rows) {
    if (!row.id) continue;
    if (seen.has(row.id)) reruns += 1;
    else seen.add(row.id);
  }
  return reruns;
}

function summarizeReview(decisions: MissionReviewDecisionRecord[]): MissionOutcome['review'] {
  const approvals = decisions.filter(
    (decision) =>
      decision.decision === 'approve_next_slice' ||
      decision.decision === 'review_version_candidate',
  ).length;
  return {
    decisions,
    approvals,
    changeRequests: decisions.filter((decision) => decision.decision === 'request_changes').length,
    versionCandidateReviews: decisions.filter(
      (decision) => decision.decision === 'review_version_candidate',
    ).length,
  };
}

function buildWhatChanged(
  status: MissionRunStatus,
  completedCommands: number,
  failedCommands: number,
  reruns: number,
  failedStep: string | undefined,
): string[] {
  const lines: string[] = [];
  if (status === 'passed') {
    lines.push(`Mission proof passed after ${completedCommands} command(s).`);
  } else if (status === 'failed') {
    lines.push(`Mission proof failed${failedStep ? ` at ${failedStep}` : ''}.`);
  } else if (status === 'running') {
    lines.push('Mission proof is still marked running.');
  } else if (status === 'not_run') {
    lines.push('Mission proof has not run yet.');
  } else {
    lines.push('Mission proof state is unknown.');
  }
  if (failedCommands > 0) lines.push(`${failedCommands} proof command(s) exited non-zero.`);
  if (reruns > 0) lines.push(`${reruns} proof command rerun(s) recorded.`);
  return lines;
}

function buildWhatRemains(
  status: MissionRunStatus,
  nextAction: string | undefined,
  failedLog: string | undefined,
  failedStep: string | undefined,
): string[] {
  if (status === 'passed')
    return [capitalizeAction(nextAction ?? 'run ./review.sh and choose a reviewer reply.')];
  if (status === 'failed') {
    const log = failedLog ?? (failedStep ? `proof-logs/${failedStep}.log` : 'the failed proof log');
    return [`Inspect ${log}, fix the failure, then rerun ./mission.sh.`];
  }
  if (status === 'running')
    return [
      capitalizeAction(
        nextAction ?? 'wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl.',
      ),
    ];
  if (status === 'not_run')
    return [capitalizeAction(nextAction ?? 'run ./mission.sh to generate proof.')];
  return ['Inspect proof-logs/summary.json and proof-logs/status.jsonl.'];
}

function capitalizeAction(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function versionCandidateFor(
  status: MissionRunStatus,
  failedCommands: number,
): MissionOutcome['versionCandidate'] {
  if (status === 'passed' && failedCommands === 0) {
    return {
      recommendation: 'review_candidate',
      summary:
        'Mission proof passed; review a version candidate before release, publish, or version bump.',
    };
  }
  if (status === 'failed' || failedCommands > 0) {
    return {
      recommendation: 'do_not_cut',
      summary: 'Do not cut a version until failed proof is fixed and rerun.',
    };
  }
  if (status === 'running') {
    return {
      recommendation: 'wait',
      summary: 'Wait for mission proof to finish before reviewing a version candidate.',
    };
  }
  return {
    recommendation: 'run_proof',
    summary: 'Run mission proof before reviewing a version candidate.',
  };
}

function buildResumePrompt(
  status: MissionRunStatus,
  whatChanged: string[],
  whatRemains: string[],
  versionSummary: string,
): string {
  return `Mission proof ${status}. ${whatChanged.join(' ')} Next: ${whatRemains.join(' ')} Version: ${versionSummary}`;
}

function unavailableOutcome(missionDir: string, reason: string): MissionOutcome {
  return {
    schemaVersion: 1,
    available: false,
    missionDir,
    status: 'unknown',
    reason,
    proof: {
      completedCommands: 0,
      failedCommands: 0,
      reruns: 0,
      rows: [],
    },
    review: {
      decisions: [],
      approvals: 0,
      changeRequests: 0,
      versionCandidateReviews: 0,
    },
    whatChanged: ['Mission outcome is unavailable.'],
    whatRemains: [`Inspect ${missionDir}/proof-logs/summary.json.`],
    versionCandidate: {
      recommendation: 'do_not_cut',
      summary: 'Do not cut a version until mission proof can be read.',
    },
    resumePrompt: `Mission proof unavailable: ${reason}`,
  };
}
