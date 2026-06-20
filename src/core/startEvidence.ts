import { loadSession } from './session.js';
import { routesForIntent } from './startMode.js';
import { preflightModeForMission } from './startSuccessCriteria.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import type { SessionCoordinationHint } from '../types/session.js';
import type { StartReport } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

export function buildStartCoordinationHints(
  riskSources: StartReport['evidence']['riskSources'],
  mode: WorkplanMode,
  harnessHints: SessionCoordinationHint[] = [],
  intent?: string,
): SessionCoordinationHint[] {
  const preflightMode = preflightModeForMission(mode);
  const hints: SessionCoordinationHint[] = [
    {
      id: 'current-worktree-check',
      label: 'Separate current worktree evidence from session memory',
      message:
        currentWorktreeHint(riskSources.currentWorktree) +
        ' Remembered session context may include older agent touches.',
      command: `projscan preflight --mode ${preflightMode} --format json`,
    },
  ];
  const swarmHint = swarmCoordinationHintForIntent(intent);
  if (swarmHint) hints.push(swarmHint);
  hints.push(...harnessHints);
  if (riskSources.sessionMemory.totalTouchedFiles > 0) {
    hints.push({
      id: 'remembered-session-context',
      label: 'Review remembered session touches',
      message: `${riskSources.sessionMemory.totalTouchedFiles} touched file(s) come from remembered session context, not necessarily the current Git diff.`,
      command: 'projscan session touched --format json',
    });
  }
  return hints;
}

function currentWorktreeHint(
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'],
): string {
  if (!currentWorktree.available) {
    return 'Current worktree evidence is unavailable.';
  }
  const uncommittedCount =
    currentWorktree.uncommittedChangedFileCount ?? currentWorktree.count;
  const branchCount =
    currentWorktree.branchChangedFileCount ??
    Math.max(0, currentWorktree.count - uncommittedCount);
  const baseSuffix = currentWorktree.baseRef ? ` against ${currentWorktree.baseRef}` : '';
  if (uncommittedCount === 0) {
    return `Working tree has no uncommitted changes; branch diff evidence sees ${branchCount} file(s)${baseSuffix}.`;
  }
  if (branchCount === 0) {
    return `Working tree has ${uncommittedCount} uncommitted changed file(s).`;
  }
  return `Working tree has ${uncommittedCount} uncommitted changed file(s); branch diff evidence sees ${branchCount} committed file(s)${baseSuffix}.`;
}

function swarmCoordinationHintForIntent(
  intent: string | undefined,
): SessionCoordinationHint | null {
  const primaryRoute = routesForIntent(intent)[0];
  if (primaryRoute?.tool !== 'projscan_coordinate') return null;
  return {
    id: 'swarm-coordination',
    label: 'Validate swarm coordination locally',
    message:
      'Intent routes to the one-call swarm coordination read; run it before parallel edits so collisions, claims, and merge order are checked from local worktree evidence.',
    command: 'projscan coordinate --format json',
  };
}

export async function buildStartRiskSources(
  rootPath: string,
): Promise<StartReport['evidence']['riskSources']> {
  const [changed, sessionResult] = await Promise.all([
    getChangedFiles(rootPath).catch((err) => ({
      available: false,
      reason: err instanceof Error ? err.message : String(err),
      baseRef: null,
      files: [],
      uncommittedFiles: [],
    })),
    loadSession(rootPath).catch(() => null),
  ]);
  const touchedFiles = sessionResult
    ? Object.values(sessionResult.session.touchedFiles)
        .sort((a, b) => {
          const byTime = Date.parse(b.lastTouchedAt) - Date.parse(a.lastTouchedAt);
          return byTime !== 0 ? byTime : a.file.localeCompare(b.file);
        })
        .map((touch) => touch.file)
    : [];
  const visibleTouched = touchedFiles.slice(0, 40);
  return {
    currentWorktree: {
      kind: 'current-worktree',
      available: changed.available,
      count: changed.files.length,
      files: changed.files.slice(0, 40),
      baseRef: changed.baseRef,
      branchChangedFileCount: branchChangedFileCount(changed.files, changed.uncommittedFiles),
      uncommittedChangedFileCount: changed.uncommittedFiles.length,
      uncommittedFiles: changed.uncommittedFiles.slice(0, 40),
      ...(changed.reason ? { reason: changed.reason } : {}),
    },
    sessionMemory: {
      kind: 'remembered-session',
      touchedFiles: visibleTouched,
      totalTouchedFiles: touchedFiles.length,
      note: 'Remembered session context comes from prior projscan tool results, explicit touches, and MCP watch events. It may include files outside the current Git/worktree diff.',
      ...(touchedFiles.length > visibleTouched.length ? { truncated: true } : {}),
    },
  };
}

function branchChangedFileCount(files: string[], uncommittedFiles: string[]): number {
  const uncommitted = new Set(uncommittedFiles);
  return files.filter((file) => !uncommitted.has(file)).length;
}
