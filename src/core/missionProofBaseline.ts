import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  MissionProofBaselineRun,
  MissionProofReport,
  MissionProofTotals,
  MissionRunStatus,
} from '../types/start.js';

export interface MissionProofBaselineInput {
  runs?: unknown;
  [key: string]: unknown;
}

export const MISSION_PROOF_BASELINE_STATUSES = [
  'passed',
  'failed',
  'running',
  'not_run',
  'unknown',
] as const satisfies readonly MissionRunStatus[];

const BASELINE_NUMERIC_FIELDS = [
  'failedGates',
  'reruns',
  'minutesSpent',
  'reviewerApprovals',
] as const;

export async function loadMissionProofBaseline(
  rootPath: string,
  baselineFile: string,
): Promise<NonNullable<MissionProofReport['baseline']>> {
  const resolved = path.resolve(rootPath, baselineFile);
  const input = parseMissionProofBaselineInput(
    await readMissionProofBaselineFile(resolved, baselineFile),
    baselineFile,
  );
  const runs = validateMissionProofBaselineRuns(input, baselineFile);
  const totals = totalsFromBaselineRuns(runs);
  return {
    path: path.relative(rootPath, resolved) || resolved,
    runs,
    totals,
  };
}

export function missionProofBaselineTemplate(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    runs: [],
    exampleRun: {
      id: 'manual-before-mission-control',
      status: 'passed',
      minutesSpent: 30,
      reruns: 1,
      failedGates: 0,
      reviewerApprovals: 1,
    },
  };
}

export function parseMissionProofBaselineInput(
  raw: string,
  baselineFile: string,
): MissionProofBaselineInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Mission proof baseline file is not valid JSON: ${baselineFile}\n` +
        'Expected shape: {"schemaVersion":1,"runs":[...]}',
      { cause: err },
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw baselineValidationError(baselineFile, 'root', 'expected an object.');
  }
  return parsed as MissionProofBaselineInput;
}

export function validateMissionProofBaselineRuns(
  input: MissionProofBaselineInput,
  baselineFile: string,
): MissionProofBaselineRun[] {
  if (typeof input.runs === 'undefined') return [];
  if (!Array.isArray(input.runs)) {
    throw baselineValidationError(baselineFile, 'runs', 'expected an array.');
  }
  const runs = input.runs.map((run, index) =>
    validateMissionProofBaselineRun(run, index, baselineFile),
  );
  validateUniqueBaselineRunIds(runs, baselineFile);
  return runs;
}

function validateMissionProofBaselineRun(
  run: unknown,
  index: number,
  baselineFile: string,
): MissionProofBaselineRun {
  if (!run || typeof run !== 'object') {
    throw baselineValidationError(baselineFile, `runs[${index}]`, 'expected an object.');
  }
  const candidate = run as Partial<MissionProofBaselineRun>;
  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    throw baselineValidationError(
      baselineFile,
      `runs[${index}].id`,
      'expected a non-empty string.',
    );
  }
  if (!MISSION_PROOF_BASELINE_STATUSES.includes(candidate.status as MissionRunStatus)) {
    throw baselineValidationError(
      baselineFile,
      `runs[${index}].status`,
      'expected passed, failed, running, not_run, or unknown.',
    );
  }
  for (const field of BASELINE_NUMERIC_FIELDS) {
    const value = candidate[field];
    if (
      typeof value !== 'undefined' &&
      (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    ) {
      throw baselineValidationError(
        baselineFile,
        `runs[${index}].${field}`,
        'expected a non-negative number.',
      );
    }
  }
  return candidate as MissionProofBaselineRun;
}

function validateUniqueBaselineRunIds(runs: MissionProofBaselineRun[], baselineFile: string): void {
  const seen = new Set<string>();
  for (const [index, run] of runs.entries()) {
    if (seen.has(run.id)) {
      throw baselineValidationError(baselineFile, `runs[${index}].id`, `duplicate id ${run.id}.`);
    }
    seen.add(run.id);
  }
}

function totalsFromBaselineRuns(
  runs: MissionProofBaselineRun[],
): MissionProofTotals & { minutesSpent: number } {
  const passed = runs.filter((run) => run.status === 'passed').length;
  return {
    missions: runs.length,
    passed,
    failed: runs.filter((run) => run.status === 'failed').length,
    running: runs.filter((run) => run.status === 'running').length,
    notRun: runs.filter((run) => run.status === 'not_run').length,
    unavailable: runs.filter((run) => run.status === 'unknown').length,
    proofCompletionRate: runs.length > 0 ? round(passed / runs.length) : 0,
    reruns: sum(runs.map((run) => run.reruns)),
    failedGates: sum(runs.map((run) => run.failedGates)),
    reviewerApprovals: sum(runs.map((run) => run.reviewerApprovals)),
    minutesSpent: sum(runs.map((run) => run.minutesSpent)),
  };
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + (typeof value === 'number' && Number.isFinite(value) ? value : 0),
    0,
  );
}

async function readMissionProofBaselineFile(
  resolved: string,
  baselineFile: string,
): Promise<string> {
  try {
    return await fs.readFile(resolved, 'utf8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(
        `Mission proof baseline file not found: ${baselineFile}\n` +
          `Create one with: projscan mission-proof --init-baseline ${shellToken(baselineFile)}`,
        { cause: err },
      );
    }
    throw err;
  }
}

function baselineValidationError(baselineFile: string, pathLabel: string, message: string): Error {
  return new Error(
    `Mission proof baseline invalid at ${pathLabel}: ${message}\nFile: ${baselineFile}`,
  );
}

function shellToken(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/.test(value) ? value : JSON.stringify(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
