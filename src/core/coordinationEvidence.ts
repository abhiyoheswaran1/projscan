import fs from 'node:fs';
import path from 'node:path';

export interface CoordinationEvidenceWorktree {
  path: string;
  branch: string | null;
  changedFileCount: number;
  baseRef: string | null;
}

export interface CoordinationEvidenceSignal {
  name: string;
  commandPath: string;
  source: string;
}

export interface CoordinationValidationStep {
  command: string;
  purpose: string;
}

export interface CoordinationSessionSeparation {
  currentEvidence: string;
  rememberedContext: string;
  command: string;
}

export interface CoordinationCommandEvidence {
  commandPath: string;
  command: string;
  localOnly: true;
  worktreeCount: number;
  currentWorktree: CoordinationEvidenceWorktree | null;
  activeSignals: CoordinationEvidenceSignal[];
  validationWorkflow: CoordinationValidationStep[];
  sessionSeparation: CoordinationSessionSeparation;
}

export function buildCollisionCommandEvidence(
  rootPath: string,
  worktrees: CoordinationEvidenceWorktree[],
): CoordinationCommandEvidence {
  return {
    commandPath: 'projscan collisions',
    command: 'projscan collisions --format json',
    localOnly: true,
    worktreeCount: worktrees.length,
    currentWorktree: findCurrentWorktree(rootPath, worktrees),
    activeSignals: [
      {
        name: 'collisions',
        commandPath: 'projscan collisions',
        source: 'git worktree list, local diffs, and the local import graph',
      },
    ],
    validationWorkflow: validationWorkflow(),
    sessionSeparation: sessionSeparation(),
  };
}

export function buildCoordinateCommandEvidence(
  collisionEvidence: CoordinationCommandEvidence | undefined,
  worktreeCount: number,
): CoordinationCommandEvidence {
  return {
    commandPath: 'projscan coordinate',
    command: 'projscan coordinate --format json',
    localOnly: true,
    worktreeCount,
    currentWorktree: collisionEvidence?.currentWorktree ?? null,
    activeSignals: [
      {
        name: 'collisions',
        commandPath: 'projscan collisions',
        source: 'git worktree list, local diffs, and the local import graph',
      },
      {
        name: 'claims',
        commandPath: 'projscan claim list',
        source: 'the local .projscan-cache claim store',
      },
      {
        name: 'merge-risk',
        commandPath: 'projscan merge-risk',
        source: 'collision-derived local integration order and hot-file evidence',
      },
      {
        name: 'watch',
        commandPath: 'projscan coordinate --watch',
        source: 'local polling of worktree state; no daemon or cloud service',
      },
    ],
    validationWorkflow: validationWorkflow(),
    sessionSeparation: sessionSeparation(),
  };
}

function validationWorkflow(): CoordinationValidationStep[] {
  return [
    {
      command: 'projscan collisions --format json',
      purpose: 'Find same-file and dependency overlaps across sibling worktrees.',
    },
    {
      command: 'projscan claim list --format json',
      purpose: 'Review advisory file, directory, or symbol ownership leases.',
    },
    {
      command: 'projscan merge-risk --format json',
      purpose: 'Choose the least-entangled integration order before handoff or merge.',
    },
    {
      command: 'projscan coordinate --format json',
      purpose: 'Read the one-call swarm readiness verdict.',
    },
    {
      command: 'projscan coordinate --watch --interval 5 --format json',
      purpose: 'Watch local coordination state changes while parallel work continues.',
    },
    {
      command: 'projscan agent-brief --format json',
      purpose: 'Carry coordination hints into the next-agent packet without mixing session memory.',
    },
  ];
}

function sessionSeparation(): CoordinationSessionSeparation {
  return {
    currentEvidence:
      'Current worktree evidence is read from local git/worktree state during this command.',
    rememberedContext:
      'Remembered session context is read separately through projscan session and agent-brief coordination hints.',
    command: 'projscan agent-brief --format json',
  };
}

function findCurrentWorktree(
  rootPath: string,
  worktrees: CoordinationEvidenceWorktree[],
): CoordinationEvidenceWorktree | null {
  const resolvedRoot = canonicalPath(rootPath);
  return worktrees.find((worktree) => canonicalPath(worktree.path) === resolvedRoot) ?? null;
}

function canonicalPath(value: string): string {
  try {
    return fs.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}
