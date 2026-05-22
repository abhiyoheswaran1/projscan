import fs from 'node:fs/promises';
import path from 'node:path';
import { computePreflight } from './preflight.js';
import type {
  PreflightSuggestedAction,
  ReleaseTrainReport,
  ReleaseTrainTask,
  ReleaseTrainTrack,
  WorkplanPriority,
} from '../types.js';

export interface ComputeReleaseTrainOptions {
  lines?: string[];
  rollup?: 'unreleased';
}

const DEFAULT_ROLLUP = 'unreleased';

export async function computeReleaseTrain(
  rootPath: string,
  options: ComputeReleaseTrainOptions = {},
): Promise<ReleaseTrainReport> {
  const currentVersion = await readPackageVersion(rootPath);
  const lines = normalizeLines(options.lines, currentVersion);
  const preflight = await computePreflight(rootPath, { mode: 'before_merge' });
  const blockers = preflight.reasons.filter((reason) => reason.severity === 'error').length;
  const cautions = preflight.reasons.filter((reason) => reason.severity === 'warning').length;
  const tracks = lines.map(trackForLine);
  const tasks = rankTasks([
    ...(blockers > 0
      ? [{
          id: 'rt-blockers-first',
          priority: 'p0' as const,
          title: 'Clear release-blocking preflight evidence',
          why: 'A rolled-up release should not accumulate feature scope on top of active blockers.',
          track: 'rollup',
          files: filesFromPreflight(preflight.reasons),
          verification: {
            commands: ['projscan preflight --mode before_merge --format json'],
            expected: 'Preflight no longer returns block.',
          },
        }]
      : []),
    ...tracks.flatMap(tasksForTrack),
    {
      id: 'rt-rollup-readiness',
      priority: blockers > 0 ? 'p1' : 'p0',
      title: 'Prove the rolled-up unreleased train is releasable',
      why: 'The collapsed train needs one final local gate across docs, tests, stability metadata, package contents, and release checks before any actual release action.',
      track: 'rollup',
      files: ['CHANGELOG.md', 'README.md', 'docs/STABILITY.md', 'package.json'],
      verification: {
        commands: ['npm test', 'npm run build', 'npm run check:stability', 'npm run release:check'],
        expected: 'All release-readiness checks pass before a separate release instruction is given.',
      },
    },
  ]);

  return {
    schemaVersion: 1,
    currentVersion,
    rollup: {
      policy: 'single-unreleased-release',
      target: DEFAULT_ROLLUP,
      lines,
      releaseMutation: false,
    },
    readiness: {
      verdict: preflight.verdict,
      blockers,
      cautions,
      summary: preflight.summary,
    },
    tracks,
    tasks,
    suggestedNextActions: suggestedActions(tasks, preflight.suggestedNextActions),
  };
}

function trackForLine(line: string): ReleaseTrainTrack {
  if (line.startsWith('2.3')) {
    return {
      line,
      theme: 'Agent Mission Control',
      outcome: 'Agents can decide what to do next, hand off safely, and prove readiness without rereading the whole repo.',
      includedInRollup: true,
      scope: [
        'prioritized workplans',
        'handoff-ready next actions',
        'release-train planning without publish mutation',
      ],
      successCriteria: [
        'MCP and CLI expose the same planning contracts',
        'plans include evidence, priority, and verification commands',
        'release planning does not bump versions, create tags, or publish',
      ],
    };
  }
  if (line.startsWith('2.4')) {
    return {
      line,
      theme: 'Autonomous Bug Hunt',
      outcome: 'Agents get a ranked fix queue that combines health, preflight, hotspots, and coordination evidence.',
      includedInRollup: true,
      scope: [
        'bug-hunt fix queue',
        'verification matrix',
        'broad test-suite reliability pass',
      ],
      successCriteria: [
        'bug-hunt output names the first fix target and commands to prove it',
        'clean repos still receive reproducible verification guidance',
        'full project verification passes from the committed tree',
      ],
    };
  }
  return {
    line,
    theme: 'Quality and Release Hardening',
    outcome: 'The line is folded into the unreleased train with explicit readiness checks.',
    includedInRollup: true,
    scope: ['quality fixes', 'documentation alignment', 'release readiness'],
    successCriteria: ['all checks pass', 'public surface is documented', 'release mutation remains false'],
  };
}

function tasksForTrack(track: ReleaseTrainTrack): ReleaseTrainTask[] {
  if (track.line.startsWith('2.3')) {
    return [
      {
        id: 'rt-2-3-agent-readiness',
        priority: 'p0',
        title: 'Finish agent mission-control readiness',
        why: 'Planning tools only matter if they produce short, ordered, evidence-backed actions that another agent can execute.',
        track: track.line,
        files: ['src/core/workplan.ts', 'src/cli/commands/workplan.ts', 'src/mcp/tools/workplan.ts'],
        verification: {
          commands: ['projscan workplan --mode release --format json', 'projscan handoff'],
          expected: 'Workplan and handoff both include prioritized tasks and verification commands.',
        },
      },
    ];
  }
  if (track.line.startsWith('2.4')) {
    return [
      {
        id: 'rt-2-4-bug-hunt-gate',
        priority: 'p0',
        title: 'Ship the autonomous bug-hunt gate',
        why: 'Before a larger release, the product should tell agents where to polish first and how to prove each fix.',
        track: track.line,
        files: ['src/core/bugHunt.ts', 'src/cli/commands/bugHunt.ts', 'src/mcp/tools/bugHunt.ts'],
        verification: {
          commands: ['projscan bug-hunt --format json', 'npm test'],
          expected: 'Bug hunt returns a prioritized fix queue and the test suite passes.',
        },
      },
    ];
  }
  return [
    {
      id: `rt-${slug(track.line)}-quality`,
      priority: 'p1',
      title: `Fold ${track.line} quality work into the unreleased train`,
      why: 'Every line in the train needs an explicit verification task.',
      track: track.line,
      files: [],
      verification: {
        commands: ['npm test', 'npm run lint'],
        expected: 'Quality checks pass for this release line.',
      },
    },
  ];
}

function suggestedActions(
  tasks: ReleaseTrainTask[],
  preflightActions: PreflightSuggestedAction[],
): PreflightSuggestedAction[] {
  return [
    ...tasks.slice(0, 5).map((task) => ({
      label: task.title,
      command: task.verification.commands[0],
    })),
    ...preflightActions,
  ].slice(0, 12);
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
  const [major = 0, minor = 0] = (currentVersion ?? '2.2.0').split('.').map((part) => Number.parseInt(part, 10));
  const safeMajor = Number.isFinite(major) ? major : 2;
  const safeMinor = Number.isFinite(minor) ? minor : 2;
  return [`${safeMajor}.${safeMinor + 1}.x`, `${safeMajor}.${safeMinor + 2}.x`];
}

function rankTasks(tasks: ReleaseTrainTask[]): ReleaseTrainTask[] {
  return tasks.sort((a, b) => {
    const blocker = blockerRank(a.id) - blockerRank(b.id);
    if (blocker !== 0) return blocker;
    return priorityRank(a.priority) - priorityRank(b.priority) || a.id.localeCompare(b.id);
  });
}

function filesFromPreflight(reasons: Array<{ file?: string }>): string[] {
  return [...new Set(reasons.map((reason) => reason.file).filter((file): file is string => typeof file === 'string'))];
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function blockerRank(id: string): number {
  return id === 'rt-blockers-first' ? 0 : 1;
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'line';
}
