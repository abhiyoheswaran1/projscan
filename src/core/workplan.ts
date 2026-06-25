import { fixFirstFromWorkplanRisk, fixFirstFromWorkplanTask } from './fixFirst.js';
import { computePreflight, type ComputePreflightOptions } from './preflight.js';
import { buildRiskNow } from './sessionResources.js';
import { loadOwnership } from './ownership.js';
import { buildCoordination, tasksFromCoordination } from './workplanCoordinationTasks.js';
import { modeTasks } from './workplanModeTasks.js';
import { tasksFromPreflight } from './workplanPreflightTasks.js';
import { safeQualitySignals } from './workplanQualitySignals.js';
import {
  buildWorkplanHandoffPayload,
  rankWorkplanTasks,
  summarizeWorkplan,
} from './workplanReport.js';
import { annotateTasksWithOwners, annotateTopRisksWithOwners, buildTopRisks } from './workplanRiskOwnership.js';
import { buildWorkplanSuggestedActions } from './workplanSuggestedActions.js';
import type {
  PreflightMode,
  SessionConflict,
  WorkplanHandoffPayload,
  WorkplanMode,
  WorkplanReport,
} from '../types.js';

export interface ComputeWorkplanOptions {
  mode?: WorkplanMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  maxTasks?: number;
  enablePlugins?: boolean;
}

const DEFAULT_MAX_TASKS = 8;
const MAX_TOP_RISKS = 8;
const MAX_COORDINATION_FILES = 20;
const WORKPLAN_MODES: readonly WorkplanMode[] = [
  'before_edit',
  'before_commit',
  'before_merge',
  'refactor',
  'release',
  'bug_hunt',
  'hardening',
];

export function isWorkplanMode(value: string): value is WorkplanMode {
  return (WORKPLAN_MODES as readonly string[]).includes(value);
}

export async function computeWorkplan(
  rootPath: string,
  options: ComputeWorkplanOptions = {},
): Promise<WorkplanReport> {
  const mode = options.mode ?? 'before_edit';
  const preflightMode = modeToPreflightMode(mode);
  const preflight = await computePreflight(rootPath, {
    mode: preflightMode,
    baseRef: options.baseRef,
    headRef: options.headRef,
    maxChangedFiles: options.maxChangedFiles,
    enablePlugins: options.enablePlugins,
  } satisfies ComputePreflightOptions);
  const [riskNow, ownership, qualitySignals] = await Promise.all([
    safeRiskNow(rootPath),
    loadOwnership(rootPath).catch(() => undefined),
    safeQualitySignals(rootPath, mode, MAX_TOP_RISKS),
  ]);
  const coordination = buildCoordination(
    preflight.verdict,
    riskNow.touchedFiles,
    riskNow.conflicts,
  );
  const modeFiles = unique([...coordination.touchedFiles, ...qualitySignals.files]);
  const tasks = rankWorkplanTasks([
    ...tasksFromPreflight(preflight.reasons),
    ...tasksFromCoordination(coordination),
    ...modeTasks(mode, preflight.verdict, modeFiles, qualitySignals.evidence),
  ]);
  const maxTasks = normalizeMaxTasks(options.maxTasks);
  const limitedTasks = annotateTasksWithOwners(tasks.slice(0, maxTasks), ownership);
  const topRisks = annotateTopRisksWithOwners(
    buildTopRisks(preflight.reasons, coordination.conflicts, qualitySignals.topRisks),
    ownership,
  );
  const fixFirst =
    fixFirstFromWorkplanTask(limitedTasks[0]) ?? fixFirstFromWorkplanRisk(topRisks[0]);
  const truncated =
    tasks.length > limitedTasks.length ||
    preflight.truncated === true ||
    riskNow.truncated === true ||
    coordination.touchedFiles.length > MAX_COORDINATION_FILES;

  return {
    schemaVersion: 1,
    mode,
    verdict: preflight.verdict,
    summary: summarizeWorkplan(mode, preflight.verdict, limitedTasks, topRisks),
    topRisks,
    tasks: limitedTasks,
    ...(fixFirst ? { fixFirst } : {}),
    coordination,
    suggestedNextActions: buildWorkplanSuggestedActions(
      preflight.suggestedNextActions,
      limitedTasks,
    ),
    ...(truncated ? { truncated: true } : {}),
  };
}

export function buildWorkplanHandoff(report: WorkplanReport): WorkplanHandoffPayload {
  return buildWorkplanHandoffPayload(report);
}

function modeToPreflightMode(mode: WorkplanMode): PreflightMode {
  if (mode === 'before_commit' || mode === 'before_merge' || mode === 'before_edit') return mode;
  if (mode === 'release') return 'before_merge';
  return 'before_edit';
}

async function safeRiskNow(rootPath: string): Promise<{
  conflicts: SessionConflict[];
  touchedFiles: string[];
  truncated?: boolean;
}> {
  try {
    return await buildRiskNow(rootPath);
  } catch (err) {
    return {
      conflicts: [
        {
          kind: 'same-file',
          files: [],
          message: `coordination signals unavailable: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'warning',
        },
      ],
      touchedFiles: [],
    };
  }
}

export { rankWorkplanTasks };

function normalizeMaxTasks(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_TASKS;
  return Math.max(1, Math.min(20, Math.floor(value)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
