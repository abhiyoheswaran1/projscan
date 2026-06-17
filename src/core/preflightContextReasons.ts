import type { CoordinationSummary } from './coordination.js';
import type { HealthScore, HotspotReport, PreflightMode, PreflightReason } from '../types.js';

interface ChangedFilesEvidence {
  available: boolean;
}

interface SessionEvidence {
  touchedFiles: string[];
}

type HotspotEvidence = HotspotReport['hotspots'][number];

export function contextReasons(input: {
  mode: PreflightMode;
  changedFiles: ChangedFilesEvidence;
  health: HealthScore;
  session: SessionEvidence;
  hotspots: HotspotReport | null;
  coordination: CoordinationSummary | null;
}): PreflightReason[] {
  return [
    ...sessionHotspotReasons(input.session, input.hotspots),
    ...optionalReason(changedFileScopeHealthReason(input.mode, input.changedFiles, input.health)),
    ...optionalReason(coordinationReason(input.coordination)),
  ];
}

function optionalReason(reason: PreflightReason | undefined): PreflightReason[] {
  return reason ? [reason] : [];
}

function sessionHotspotReasons(
  session: SessionEvidence,
  hotspots: HotspotReport | null,
): PreflightReason[] {
  const touched = new Set(session.touchedFiles);
  return touchedHighRiskHotspots(touched, hotspots).slice(0, 3).map(sessionHotspotReason);
}

function touchedHighRiskHotspots(
  touched: Set<string>,
  hotspots: HotspotReport | null,
): HotspotEvidence[] {
  if (hotspots?.available !== true) return [];
  return hotspots.hotspots.filter(
    (hotspot) => touched.has(hotspot.relativePath) && hotspot.riskScore >= 40,
  );
}

function sessionHotspotReason(hotspot: HotspotEvidence): PreflightReason {
  return {
    severity: 'warning',
    source: 'session',
    file: hotspot.relativePath,
    message: `Remembered session context touched high-risk hotspot ${hotspot.relativePath} (risk ${hotspot.riskScore})`,
    tool: 'projscan_session',
  };
}

function changedFileScopeHealthReason(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
  health: HealthScore,
): PreflightReason | undefined {
  if (!shouldReportChangedFileScopeHealth(mode, changedFiles, health)) return undefined;
  return {
    severity: 'warning',
    source: 'doctor',
    message: `${health.errors} project health error(s) exist; changed-file scoping was unavailable`,
    tool: 'projscan_doctor',
  };
}

function shouldReportChangedFileScopeHealth(
  mode: PreflightMode,
  changedFiles: ChangedFilesEvidence,
  health: HealthScore,
): boolean {
  return health.errors > 0 && mode === 'before_merge' && !hasChangedFileScope(mode, changedFiles);
}

function hasChangedFileScope(mode: PreflightMode, changedFiles: ChangedFilesEvidence): boolean {
  return mode !== 'before_edit' && changedFiles.available;
}

function coordinationReason(coordination: CoordinationSummary | null): PreflightReason | undefined {
  if (!coordination?.available) return undefined;
  if (coordination.readiness === 'conflicted') return conflictedCoordinationReason(coordination);
  if (coordination.readiness === 'caution') return cautionCoordinationReason(coordination);
  return undefined;
}

function conflictedCoordinationReason(coordination: CoordinationSummary): PreflightReason {
  const contended =
    coordination.claims.contendedTargets > 0
      ? `, ${coordination.claims.contendedTargets} contended claim(s)`
      : '';
  return {
    severity: 'warning',
    source: 'coordination',
    message: `Swarm collision risk across ${coordination.worktreeCount} in-flight worktrees: ${coordination.collisions.high} high / ${coordination.collisions.medium} medium${contended}. Run \`projscan coordinate\` before merging.`,
    tool: 'projscan_coordinate',
  };
}

function cautionCoordinationReason(coordination: CoordinationSummary): PreflightReason {
  return {
    severity: 'info',
    source: 'coordination',
    message: `Dependency overlap with another in-flight worktree (${coordination.collisions.medium} medium). Run \`projscan coordinate\`.`,
    tool: 'projscan_coordinate',
  };
}
