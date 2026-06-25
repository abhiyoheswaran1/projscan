import type { Issue } from '../types/common.js';
import type { FileHotspot } from '../types/hotspots.js';
import type { QualityScorecardDimension } from '../types/qualityScorecard.js';
import type { SessionConflict } from '../types/session.js';

interface QualityHealth {
  score: number;
  grade: string;
  errors: number;
  warnings: number;
  infos: number;
}

const MAINTAINABILITY_HOTSPOT_LINE_THRESHOLD = 300;
const MAINTAINABILITY_HOTSPOT_COMPLEXITY_THRESHOLD = 15;

export function buildQualityScorecardDimensions(
  issues: Issue[],
  health: QualityHealth,
  hotspots: FileHotspot[],
  conflicts: SessionConflict[],
): QualityScorecardDimension[] {
  const securityIssues = issues.filter(
    (issue) => issue.category === 'security' || issue.category === 'supply-chain',
  );
  const testIssues = issues.filter(
    (issue) => issue.id.includes('test') || issue.category === 'testing',
  );
  const maintainabilityIssues = issues.filter(
    (issue) => !securityIssues.includes(issue) && !testIssues.includes(issue),
  );
  return [
    {
      id: 'health',
      label: 'Project health',
      status: health.errors > 0 ? 'fail' : health.warnings > 0 ? 'watch' : 'pass',
      score: health.score,
      summary: `${health.grade} (${health.score}) with ${health.errors} error(s), ${health.warnings} warning(s), ${health.infos} info item(s)`,
      evidence: [`${issues.length} issue(s)`],
      commands: ['projscan doctor --format json'],
    },
    issueDimension('security', 'Security posture', securityIssues, [
      'projscan doctor --format json',
      'projscan preflight --mode before_edit --format json',
    ]),
    issueDimension('tests', 'Test readiness', testIssues, [
      'projscan doctor --format json',
      'npm test',
    ]),
    buildMaintainabilityDimension(maintainabilityIssues, hotspots),
    {
      id: 'coordination',
      label: 'Coordination',
      status: conflicts.some((conflict) => conflict.severity === 'error')
        ? 'fail'
        : conflicts.length > 0
          ? 'watch'
          : 'pass',
      score: clampScore(
        100 -
          conflicts.filter((conflict) => conflict.severity === 'error').length * 25 -
          conflicts.filter((conflict) => conflict.severity === 'warning').length * 10,
      ),
      summary: `${conflicts.length} coordination signal(s)`,
      evidence: conflicts.slice(0, 4).map((conflict) => conflict.message),
      commands: ['projscan session touched --format json', 'projscan agent-brief --format json'],
    },
  ];
}

function buildMaintainabilityDimension(
  maintainabilityIssues: Issue[],
  hotspots: FileHotspot[],
): QualityScorecardDimension {
  const penaltyHotspots = hotspots.filter(isMaintainabilityPenaltyHotspot);
  return {
    id: 'maintainability',
    label: 'Maintainability',
    status: maintainabilityIssues.some((issue) => issue.severity === 'error')
      ? 'fail'
      : hotspots.length > 0 || maintainabilityIssues.length > 0
        ? 'watch'
        : 'pass',
    score: clampScore(100 - maintainabilityIssues.length * 10 - penaltyHotspots.length * 12),
    summary: `${maintainabilityIssues.length} maintainability issue(s), ${hotspots.length} hotspot(s)`,
    evidence: [
      ...maintainabilityIssues.slice(0, 3).map((issue) => issue.title),
      ...rankHotspotsForEvidence(hotspots)
        .slice(0, 3)
        .map((hotspot) => `${hotspot.relativePath}: risk ${Math.round(hotspot.riskScore)}`),
    ],
    commands: ['projscan hotspots --format json', 'projscan quality-scorecard --format json'],
  };
}

function rankHotspotsForEvidence(hotspots: FileHotspot[]): FileHotspot[] {
  return hotspots
    .map((hotspot, index) => ({ hotspot, index }))
    .sort((a, b) => hotspotEvidenceRank(a.hotspot) - hotspotEvidenceRank(b.hotspot) || a.index - b.index)
    .map((entry) => entry.hotspot);
}

function hotspotEvidenceRank(hotspot: FileHotspot): number {
  return isMaintainabilityPenaltyHotspot(hotspot) ? 1 : 2;
}

export function isMaintainabilityPenaltyHotspot(hotspot: FileHotspot): boolean {
  return (
    hotspot.issueCount > 0 ||
    hotspot.lineCount >= MAINTAINABILITY_HOTSPOT_LINE_THRESHOLD ||
    (hotspot.cyclomaticComplexity ?? 0) >= MAINTAINABILITY_HOTSPOT_COMPLEXITY_THRESHOLD
  );
}

function issueDimension(
  id: QualityScorecardDimension['id'],
  label: string,
  issues: Issue[],
  commands: string[],
): QualityScorecardDimension {
  return {
    id,
    label,
    status: issues.some((issue) => issue.severity === 'error')
      ? 'fail'
      : issues.length > 0
        ? 'watch'
        : 'pass',
    score: clampScore(
      100 -
        issues.filter((issue) => issue.severity === 'error').length * 25 -
        issues.filter((issue) => issue.severity === 'warning').length * 12 -
        issues.filter((issue) => issue.severity === 'info').length * 4,
    ),
    summary: issues.length === 0 ? 'No open signals' : `${issues.length} signal(s)`,
    evidence: issues.slice(0, 4).map((issue) => issue.title),
    commands,
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
