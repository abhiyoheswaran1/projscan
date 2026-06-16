import { loadMissionOutcome } from './missionOutcome.js';
import { loadMissionProofBaseline } from './missionProofBaseline.js';
import type {
  MissionOutcome,
  MissionProofReport,
  MissionProofTotals,
  MissionRunStatus,
} from '../types/start.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';

export interface ComputeMissionProofOptions {
  missions?: string[];
  baselineFile?: string;
}

export async function computeMissionProofReport(
  rootPath: string,
  options: ComputeMissionProofOptions = {},
): Promise<MissionProofReport> {
  const missions = normalizeMissions(options.missions);
  const outcomes = await Promise.all(
    missions.map((mission) => loadMissionOutcome(rootPath, mission)),
  );
  const missionTotals = totalsFromOutcomes(outcomes);
  const baseline = options.baselineFile
    ? await loadMissionProofBaseline(rootPath, options.baselineFile)
    : undefined;
  const comparison = baseline
    ? {
        completionRateDelta: round(
          missionTotals.proofCompletionRate - baseline.totals.proofCompletionRate,
        ),
        rerunsAvoided: Math.max(0, baseline.totals.reruns - missionTotals.reruns),
        failedGatesAvoided: Math.max(0, baseline.totals.failedGates - missionTotals.failedGates),
        minutesSaved: Math.max(0, baseline.totals.minutesSpent),
      }
    : undefined;
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
    proofCompletionRate:
      outcomes.length > 0 ? round(countStatus(available, 'passed') / outcomes.length) : 0,
    reruns: available.reduce((sum, outcome) => sum + outcome.proof.reruns, 0),
    failedGates: available.reduce((sum, outcome) => sum + outcome.proof.failedCommands, 0),
    reviewerApprovals: available.reduce((sum, outcome) => sum + outcome.review.approvals, 0),
  };
}

function countStatus(outcomes: MissionOutcome[], status: MissionRunStatus): number {
  return outcomes.filter((outcome) => outcome.status === status).length;
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
    lines.push(
      `${comparison.failedGatesAvoided} failed gate(s) avoided versus the manual baseline.`,
    );
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
    command:
      'projscan feedback add --file .projscan-feedback.json --repo <repo> --pr <url> --reviewer <handle> --useful true --minutes-saved 10',
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
