import fs from 'node:fs/promises';
import path from 'node:path';
import { computePreflight } from './preflight.js';
import {
  defaultRoadmapLinesForVersion,
  roadmapTasksForLine,
  roadmapTrackForLine,
} from './roadmapCatalog.js';
import { fallbackTasksForTrack, fallbackTrackForLine } from './releaseTrainFallbacks.js';
import type {
  PreflightSuggestedAction,
  ReleaseTrainReport,
  ReleaseTrainReadinessAction,
  ReleaseTrainTask,
  ReleaseTrainTrack,
  WorkplanPriority,
} from '../types.js';

export interface ComputeReleaseTrainOptions {
  lines?: string[];
}

interface ReleaseTrainReadinessActionInput {
  verdict: ReleaseTrainReport['readiness']['verdict'];
  blockers: number;
  cautions: number;
  summary: string;
  action?: ReleaseTrainReadinessAction;
  releaseScaleDetected?: boolean;
}

export async function computeReleaseTrain(
  rootPath: string,
  options: ComputeReleaseTrainOptions = {},
): Promise<ReleaseTrainReport> {
  const currentVersion = await readPackageVersion(rootPath);
  const lines = normalizeLines(options.lines, currentVersion);
  const preflight = await computePreflight(rootPath, { mode: 'before_merge' });
  const blockers = preflight.reasons.filter((reason) => reason.severity === 'error').length;
  const cautions = preflight.reasons.filter((reason) => reason.severity === 'warning').length;
  const readinessAction = resolveReleaseTrainReadinessAction({
    verdict: preflight.verdict,
    blockers,
    cautions,
    summary: preflight.summary,
    releaseScaleDetected: preflight.evidence.releaseScale?.detected === true,
  });
  const tracks = lines.map(trackForLine);
  const tasks = rankTasks([
    ...(blockers > 0
      ? [
          {
            id: 'rt-blockers-first',
            priority: 'p0' as const,
            title: 'Clear readiness blockers',
            why: 'Product planning should stay anchored to active safety and quality evidence.',
            track: 'plan',
            files: filesFromPreflight(preflight.reasons),
            verification: {
              commands: ['projscan preflight --mode before_merge --format json'],
              expected: 'Preflight no longer returns block.',
            },
          },
        ]
      : []),
    ...tracks.flatMap(tasksForTrack),
    {
      id: 'rt-plan-readiness',
      priority: blockers > 0 ? 'p1' : 'p0',
      title: 'Prove product readiness',
      why: 'The product needs one final local gate across docs, tests, stability metadata, and package contents before handoff.',
      track: 'plan',
      files: ['CHANGELOG.md', 'README.md', 'docs/STABILITY.md', 'package.json'],
      verification: {
        commands: ['npm test', 'npm run build', 'npm run check:stability', 'npm run release:check'],
        expected: 'All readiness checks pass before handoff.',
      },
    },
  ]);

  return {
    schemaVersion: 1,
    currentVersion,
    plan: {
      policy: 'product-readiness-plan',
      lines,
      readOnly: true,
    },
    readiness: {
      verdict: preflight.verdict,
      blockers,
      cautions,
      summary: preflight.summary,
      action: readinessAction,
    },
    tracks,
    tasks,
    suggestedNextActions: suggestedActions(tasks, preflight.suggestedNextActions, readinessAction),
  };
}

function trackForLine(line: string): ReleaseTrainTrack {
  const roadmapTrack = roadmapTrackForLine(line);
  if (roadmapTrack) return roadmapTrack;
  return fallbackTrackForLine(line);
}

function tasksForTrack(track: ReleaseTrainTrack): ReleaseTrainTask[] {
  const roadmapTasks = roadmapTasksForLine(track.line);
  if (roadmapTasks.length > 0) return roadmapTasks;
  return fallbackTasksForTrack(track);
}

function suggestedActions(
  tasks: ReleaseTrainTask[],
  preflightActions: PreflightSuggestedAction[],
  readinessAction: ReleaseTrainReadinessAction,
): PreflightSuggestedAction[] {
  return [
    {
      label: readinessAction.label,
      command: readinessAction.command,
    },
    ...tasks.slice(0, 5).map((task) => ({
      label: task.title,
      command: task.verification.commands[0],
    })),
    ...preflightActions,
  ].slice(0, 12);
}

export function resolveReleaseTrainReadinessAction(
  readiness: ReleaseTrainReadinessActionInput,
): ReleaseTrainReadinessAction {
  if (readiness.action) return readiness.action;
  const command = 'projscan preflight --mode before_merge --format json';
  if (readiness.blockers > 0) {
    return {
      kind: 'fix-blockers',
      label: 'Clear readiness blockers',
      command,
      detail: `${readiness.blockers} blocker(s) must be cleared or explicitly accepted before release review continues.`,
    };
  }
  if (isManualReleaseSignoff(readiness)) {
    return {
      kind: 'manual-signoff',
      label: 'Manual release sign-off required',
      command,
      detail:
        'Release-scale caution needs human sign-off; it is not a concrete defect blocker.',
    };
  }
  if (readiness.cautions > 0 || readiness.verdict === 'caution') {
    return {
      kind: 'review-cautions',
      label: 'Review readiness cautions',
      command,
      detail: `${readiness.cautions} caution(s) need review before approval.`,
    };
  }
  return {
    kind: 'proceed',
    label: 'Keep release evidence fresh',
    command,
    detail: 'No blocking or cautionary release-train signals were found.',
  };
}

function isManualReleaseSignoff(readiness: ReleaseTrainReadinessActionInput): boolean {
  if (readiness.releaseScaleDetected) return true;
  return /manual release sign-off|large platform release risk/i.test(readiness.summary);
}

async function readPackageVersion(rootPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function normalizeLines(lines: string[] | undefined, currentVersion: string | null): string[] {
  const cleaned = (lines ?? []).map((line) => line.trim()).filter(Boolean);
  if (cleaned.length > 0) return [...new Set(cleaned)];
  const catalogLines = defaultRoadmapLinesForVersion(currentVersion);
  if (catalogLines) return catalogLines;
  const [major = 0, minor = 0] = (currentVersion ?? '2.2.0')
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  const safeMajor = Number.isFinite(major) ? major : 2;
  const safeMinor = Number.isFinite(minor) ? minor : 2;
  return [
    `${safeMajor}.${safeMinor + 1}.x`,
    `${safeMajor}.${safeMinor + 2}.x`,
    `${safeMajor}.${safeMinor + 3}.x`,
    `${safeMajor}.${safeMinor + 4}.x`,
    `${safeMajor}.${safeMinor + 5}.x`,
    `${safeMajor}.${safeMinor + 6}.x`,
  ];
}

function rankTasks(tasks: ReleaseTrainTask[]): ReleaseTrainTask[] {
  return tasks.sort((a, b) => {
    const blocker = blockerRank(a.id) - blockerRank(b.id);
    if (blocker !== 0) return blocker;
    return priorityRank(a.priority) - priorityRank(b.priority) || a.id.localeCompare(b.id);
  });
}

function filesFromPreflight(reasons: Array<{ file?: string }>): string[] {
  return [
    ...new Set(
      reasons
        .map((reason) => reason.file)
        .filter((file): file is string => typeof file === 'string'),
    ),
  ];
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function blockerRank(id: string): number {
  return id === 'rt-blockers-first' ? 0 : 1;
}
