import { isMaintainabilityPenaltyHotspot } from './qualityScorecardDimensions.js';
import { quoteShellArg } from './startShellArgs.js';
import type { Issue } from '../types/common.js';
import type { FileHotspot } from '../types/hotspots.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { QualityScorecardRisk } from '../types/qualityScorecard.js';
import type { SessionConflict } from '../types/session.js';
import type { WorkplanPriority } from '../types/workplan.js';

export function qualityScorecardRisks(
  issues: Issue[],
  hotspots: FileHotspot[],
  conflicts: SessionConflict[],
): QualityScorecardRisk[] {
  return rankRisks([
    ...issues.map(issueToRisk),
    ...hotspots.map(hotspotToRisk),
    ...conflicts.map(conflictToRisk),
  ]);
}

export function baselineQualityScorecardRisk(): QualityScorecardRisk {
  return {
    id: 'qs-baseline',
    priority: 'p2',
    title: 'Preserve the clean quality baseline',
    files: [],
    source: 'issue',
    command: 'projscan quality-scorecard --format json',
  };
}

export function suggestQualityScorecardActions(
  risks: QualityScorecardRisk[],
): PreflightSuggestedAction[] {
  return risks.slice(0, 8).map((risk) => ({
    label: risk.title,
    command: risk.command,
  }));
}

function issueToRisk(issue: Issue): QualityScorecardRisk {
  return {
    id: `qs-issue-${issue.id}`,
    priority: severityPriority(issue.severity),
    title: issue.title,
    files: issueFiles(issue),
    source: 'issue',
    command: 'projscan doctor --format json',
  };
}

function hotspotToRisk(hotspot: FileHotspot): QualityScorecardRisk {
  return {
    id: `qs-hotspot-${slug(hotspot.relativePath)}`,
    priority: hotspotRiskPriority(hotspot),
    title: `Hotspot ${hotspot.relativePath}`,
    files: [hotspot.relativePath],
    source: 'hotspot',
    command: `projscan file ${quoteShellArg(hotspot.relativePath)} --format json`,
  };
}

function hotspotRiskPriority(hotspot: FileHotspot): WorkplanPriority {
  if (!isMaintainabilityPenaltyHotspot(hotspot)) return 'p2';
  return 'p1';
}

function conflictToRisk(conflict: SessionConflict, index: number): QualityScorecardRisk {
  return {
    id: `qs-conflict-${index + 1}`,
    priority: conflict.severity === 'error' ? 'p0' : 'p1',
    title: conflict.message,
    files: conflict.files,
    source: 'coordination',
    command: 'projscan session touched --format json',
  };
}

function rankRisks(risks: QualityScorecardRisk[]): QualityScorecardRisk[] {
  const seen = new Set<string>();
  return risks
    .map((risk, index) => ({ risk, index }))
    .filter((entry) => {
      const { risk } = entry;
      if (seen.has(risk.id)) return false;
      seen.add(risk.id);
      return true;
    })
    .sort(
      (a, b) =>
        priorityRank(a.risk.priority) - priorityRank(b.risk.priority) ||
        sourceRank(a.risk.source) - sourceRank(b.risk.source) ||
        a.index - b.index,
    )
    .map((entry) => entry.risk);
}

function issueFiles(issue: Issue): string[] {
  return [...new Set((issue.locations ?? []).map((location) => location.file).filter(Boolean))];
}

function severityPriority(severity: Issue['severity']): WorkplanPriority {
  if (severity === 'error') return 'p0';
  if (severity === 'warning') return 'p1';
  return 'p2';
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function sourceRank(source: QualityScorecardRisk['source']): number {
  if (source === 'issue') return 0;
  if (source === 'hotspot') return 1;
  return 2;
}

function slug(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'root'
  );
}
