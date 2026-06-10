import fs from 'node:fs/promises';
import path from 'node:path';
import { loadMissionOutcome } from './missionOutcome.js';
import type {
  MissionOutcome,
  MissionProofBaselineRun,
  MissionProofReport,
  MissionProofTotals,
  MissionRunStatus,
  PreflightSuggestedAction,
} from '../types.js';

export interface ComputeMissionProofOptions {
  missions?: string[];
  baselineFile?: string;
}

interface BaselineInput {
  runs?: MissionProofBaselineRun[];
}

export async function computeMissionProofReport(
  rootPath: string,
  options: ComputeMissionProofOptions = {},
): Promise<MissionProofReport> {
  const missions = normalizeMissions(options.missions);
  const outcomes = await Promise.all(missions.map((mission) => loadMissionOutcome(rootPath, mission)));
  const missionTotals = totalsFromOutcomes(outcomes);
  const baseline = options.baselineFile
    ? await loadBaseline(rootPath, options.baselineFile)
    : undefined;
  const comparison = baseline ? {
    completionRateDelta: round(missionTotals.proofCompletionRate - baseline.totals.proofCompletionRate),
    rerunsAvoided: Math.max(0, baseline.totals.reruns - missionTotals.reruns),
    failedGatesAvoided: Math.max(0, baseline.totals.failedGates - missionTotals.failedGates),
    minutesSaved: Math.max(0, baseline.totals.minutesSpent),
  } : undefined;
  const riskAvoided = buildRiskAvoided(missionTotals, comparison);
  return {
    schemaVersion: 1,
    readOnly: true,
    rootPath,
    summary: summarize(missionTotals, baseline?.totals),
    missionControl: {
      missions: outcomes,
      totals: missionTotals,
    },
    ...(baseline ? { baseline } : {}),
    ...(comparison ? { comparison } : {}),
    riskAvoided,
    nextActions: buildNextActions(outcomes),
  };
}

function normalizeMissions(missions: string[] | undefined): string[] {
  const values = missions && missions.length > 0 ? missions : ['.projscan/mission'];
  return [...new Set(values)];
}

function totalsFromOutcomes(outcomes: MissionOutcome[]): MissionProofTotals {
  const available = outcomes.filter((outcome) => outcome.available);
  return {
    missions: outcomes.length,
    passed: countStatus(available, 'passed'),
    failed: countStatus(available, 'failed'),
    running: countStatus(available, 'running'),
    notRun: countStatus(available, 'not_run'),
    unavailable: outcomes.length - available.length,
    proofCompletionRate: outcomes.length > 0 ? round(countStatus(available, 'passed') / outcomes.length) : 0,
    reruns: available.reduce((sum, outcome) => sum + outcome.proof.reruns, 0),
    failedGates: available.reduce((sum, outcome) => sum + outcome.proof.failedCommands, 0),
    reviewerApprovals: available.reduce((sum, outcome) => sum + outcome.review.approvals, 0),
  };
}

function countStatus(outcomes: MissionOutcome[], status: MissionRunStatus): number {
  return outcomes.filter((outcome) => outcome.status === status).length;
}

async function loadBaseline(
  rootPath: string,
  baselineFile: string,
): Promise<NonNullable<MissionProofReport['baseline']>> {
  const resolved = path.resolve(rootPath, baselineFile);
  const input = JSON.parse(await fs.readFile(resolved, 'utf8')) as BaselineInput;
  const runs = Array.isArray(input.runs) ? input.runs : [];
  const totals = totalsFromBaselineRuns(runs);
  return {
    path: path.relative(rootPath, resolved) || resolved,
    runs,
    totals,
  };
}

function totalsFromBaselineRuns(runs: MissionProofBaselineRun[]): MissionProofTotals & { minutesSpent: number } {
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
  return values.reduce<number>((total, value) => total + (typeof value === 'number' && Number.isFinite(value) ? value : 0), 0);
}

function buildRiskAvoided(
  totals: MissionProofTotals,
  comparison: MissionProofReport['comparison'],
): string[] {
  const lines: string[] = [];
  if (totals.failedGates > 0) {
    lines.push(`${totals.failedGates} failed mission gate(s) stopped before release or publish.`);
  }
  if (comparison && comparison.failedGatesAvoided > 0) {
    lines.push(`${comparison.failedGatesAvoided} failed gate(s) avoided versus the manual baseline.`);
  }
  if (comparison && comparison.rerunsAvoided > 0) {
    lines.push(`${comparison.rerunsAvoided} rerun(s) avoided versus the manual baseline.`);
  }
  if (lines.length === 0) lines.push('No failed mission gates recorded yet.');
  return lines;
}

function buildNextActions(outcomes: MissionOutcome[]): PreflightSuggestedAction[] {
  const actions: PreflightSuggestedAction[] = outcomes.map((outcome) => ({
    label: `Review mission ${outcome.missionDir}`,
    command: `projscan start --mission ${shellToken(outcome.missionDir)}`,
  }));
  actions.push({
    label: 'Capture reviewer feedback',
    command: 'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
  });
  return actions;
}

function summarize(
  totals: MissionProofTotals,
  baseline: (MissionProofTotals & { minutesSpent: number }) | undefined,
): string {
  const base = `${totals.missions} mission bundle(s): ${totals.passed} passed, ${totals.failed} failed, ${totals.running} running, ${totals.notRun} not run.`;
  if (!baseline) return base;
  return `${base} Baseline: ${baseline.missions} run(s), ${baseline.reruns} rerun(s), ${baseline.failedGates} failed gate(s), ${baseline.minutesSpent} minute(s).`;
}

function shellToken(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/.test(value) ? value : JSON.stringify(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
