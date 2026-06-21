import { analyzeHotspots } from './hotspotAnalyzer.js';
import { fixFirstFromQualityRisk } from './fixFirst.js';
import { collectIssues } from './issueEngine.js';
import { scanRepository } from './repositoryScanner.js';
import { buildRiskNow } from './sessionResources.js';
import { applyConfigToIssues, loadConfig } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type { Issue } from '../types/common.js';
import type { PreflightSuggestedAction } from '../types/preflight.js';
import type { FileEntry } from '../types/scanning.js';
import type { FileHotspot } from '../types/hotspots.js';
import type {
  QualityScorecardDimension,
  QualityScorecardReport,
  QualityScorecardRisk,
  QualityScorecardVerdict,
} from '../types/qualityScorecard.js';
import type { SessionConflict } from '../types/session.js';
import type { WorkplanPriority } from '../types/workplan.js';

export interface ComputeQualityScorecardOptions {
  maxRisks?: number;
}

const DEFAULT_MAX_RISKS = 8;
const MAINTAINABILITY_HOTSPOT_LINE_THRESHOLD = 300;
const MAINTAINABILITY_HOTSPOT_COMPLEXITY_THRESHOLD = 15;

export async function computeQualityScorecard(
  rootPath: string,
  options: ComputeQualityScorecardOptions = {},
): Promise<QualityScorecardReport> {
  const maxRisks = normalizeMax(options.maxRisks);
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(
    await collectIssues(rootPath, scan.files),
    configResult.config,
  );
  const health = calculateScore(issues);
  const [riskNow, hotspots] = await Promise.all([
    safeRiskNow(rootPath),
    safeHotspots(rootPath, scan.files, issues, maxRisks),
  ]);
  const dimensions = buildDimensions(issues, health, hotspots.hotspots, riskNow.conflicts);
  const allRisks = rankRisks([
    ...issues.map(issueToRisk),
    ...(hotspots.available ? hotspots.hotspots.map(hotspotToRisk) : []),
    ...riskNow.conflicts.map(conflictToRisk),
  ]);
  const topRisks = allRisks.slice(0, maxRisks);
  const visibleTopRisks = topRisks.length > 0 ? topRisks : [baselineRisk()];
  const fixFirst = fixFirstFromQualityRisk(visibleTopRisks[0]);
  const verdict = deriveQualityScorecardVerdict(dimensions, health.score);

  return {
    schemaVersion: 1,
    verdict,
    summary: summarize(verdict, dimensions, health.score),
    health,
    dimensions,
    topRisks: visibleTopRisks,
    ...(fixFirst ? { fixFirst } : {}),
    commands: buildCommands(verdict),
    suggestedNextActions: suggestedActions(topRisks),
    ...(allRisks.length > topRisks.length ? { truncated: true } : {}),
  };
}

async function safeRiskNow(
  rootPath: string,
): Promise<{ touchedFiles: string[]; conflicts: SessionConflict[] }> {
  try {
    return await buildRiskNow(rootPath);
  } catch {
    return { touchedFiles: [], conflicts: [] };
  }
}

async function safeHotspots(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
  limit: number,
): Promise<{ available: boolean; hotspots: FileHotspot[] }> {
  try {
    const report = await analyzeHotspots(rootPath, files, issues, { limit });
    return { available: report.available, hotspots: report.hotspots };
  } catch {
    return { available: false, hotspots: [] };
  }
}

function buildDimensions(
  issues: Issue[],
  health: ReturnType<typeof calculateScore>,
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
    .sort(
      (a, b) =>
        priorityRank(hotspotRiskPriority(a.hotspot)) -
          priorityRank(hotspotRiskPriority(b.hotspot)) || a.index - b.index,
    )
    .map((entry) => entry.hotspot);
}

function isMaintainabilityPenaltyHotspot(hotspot: FileHotspot): boolean {
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
    command: `projscan file ${hotspot.relativePath} --format json`,
  };
}

function hotspotRiskPriority(hotspot: FileHotspot): WorkplanPriority {
  if (!isMaintainabilityPenaltyHotspot(hotspot)) return 'p2';
  if (hotspot.riskScore >= 70) return 'p0';
  if (hotspot.riskScore >= 30) return 'p1';
  return 'p2';
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

function baselineRisk(): QualityScorecardRisk {
  return {
    id: 'qs-baseline',
    priority: 'p2',
    title: 'Preserve the clean quality baseline',
    files: [],
    source: 'issue',
    command: 'projscan quality-scorecard --format json',
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

export function deriveQualityScorecardVerdict(
  dimensions: QualityScorecardDimension[],
  healthScore: number,
): QualityScorecardVerdict {
  if (dimensions.some((dimension) => dimension.status === 'fail')) return 'blocked';
  if (dimensions.some((dimension) => dimension.status === 'watch' && dimension.score < 70))
    return 'needs_attention';
  if (healthScore >= 95 && dimensions.every((dimension) => dimension.status === 'pass'))
    return 'excellent';
  if (healthScore >= 80) return 'healthy';
  return 'needs_attention';
}

function buildCommands(verdict: QualityScorecardVerdict): string[] {
  const commands = ['projscan quality-scorecard --format json', 'projscan doctor --format json'];
  if (verdict === 'blocked' || verdict === 'needs_attention')
    commands.push('projscan agent-brief --intent bug_hunt --format json');
  commands.push('npm test');
  return [...new Set(commands)];
}

function suggestedActions(risks: QualityScorecardRisk[]): PreflightSuggestedAction[] {
  return risks.slice(0, 8).map((risk) => ({
    label: risk.title,
    command: risk.command,
  }));
}

function summarize(
  verdict: QualityScorecardVerdict,
  dimensions: QualityScorecardDimension[],
  score: number,
): string {
  const failing = dimensions.filter((dimension) => dimension.status === 'fail').length;
  const watching = dimensions.filter((dimension) => dimension.status === 'watch').length;
  return `${verdict}: health score ${score}/100 with ${failing} failing and ${watching} watch dimension(s)`;
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

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeMax(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_RISKS;
  return Math.max(1, Math.min(25, Math.floor(value)));
}

function slug(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'root'
  );
}
