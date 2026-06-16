import { loadSession } from './session.js';
import { preflightModeForMission } from './startSuccessCriteria.js';
import { getChangedFiles } from '../utils/changedFiles.js';
import type { SessionCoordinationHint } from '../types/session.js';
import type { StartReport } from '../types/start.js';
import type { WorkplanMode } from '../types/workplan.js';

export function buildStartCoordinationHints(
  riskSources: StartReport['evidence']['riskSources'],
  mode: WorkplanMode,
  harnessHints: SessionCoordinationHint[] = [],
): SessionCoordinationHint[] {
  const preflightMode = preflightModeForMission(mode);
  const hints: SessionCoordinationHint[] = [
    {
      id: 'current-worktree-check',
      label: 'Separate current worktree evidence from session memory',
      message: `Current worktree evidence sees ${riskSources.currentWorktree.count} changed file(s); remembered session context may include older agent touches.`,
      command: `projscan preflight --mode ${preflightMode} --format json`,
    },
  ];
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

export async function buildStartRiskSources(
  rootPath: string,
): Promise<StartReport['evidence']['riskSources']> {
  const [changed, sessionResult] = await Promise.all([
    getChangedFiles(rootPath).catch((err) => ({
      available: false,
      reason: err instanceof Error ? err.message : String(err),
      baseRef: null,
      files: [],
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
