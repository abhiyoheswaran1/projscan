import { fixFirstFromQualityRisk } from './fixFirst.js';
import { collectQualityScorecardSignals } from './qualityScorecardSignals.js';
import { buildQualityScorecardDimensions } from './qualityScorecardDimensions.js';
import {
  baselineQualityScorecardRisk,
  qualityScorecardRisks,
  suggestQualityScorecardActions,
} from './qualityScorecardRisks.js';
import type {
  QualityScorecardDimension,
  QualityScorecardReport,
  QualityScorecardVerdict,
} from '../types/qualityScorecard.js';

export interface ComputeQualityScorecardOptions {
  maxRisks?: number;
}

const DEFAULT_MAX_RISKS = 8;

export async function computeQualityScorecard(
  rootPath: string,
  options: ComputeQualityScorecardOptions = {},
): Promise<QualityScorecardReport> {
  const maxRisks = normalizeMax(options.maxRisks);
  const { issues, health, hotspots, riskNow } = await collectQualityScorecardSignals(
    rootPath,
    maxRisks,
  );
  const dimensions = buildQualityScorecardDimensions(
    issues,
    health,
    hotspots.hotspots,
    riskNow.conflicts,
  );
  const allRisks = qualityScorecardRisks(
    issues,
    hotspots.available ? hotspots.hotspots : [],
    riskNow.conflicts,
  );
  const topRisks = allRisks.slice(0, maxRisks);
  const visibleTopRisks =
    topRisks.length > 0 ? topRisks : [baselineQualityScorecardRisk()];
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
    suggestedNextActions: suggestQualityScorecardActions(topRisks),
    ...(allRisks.length > topRisks.length ? { truncated: true } : {}),
  };
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

function summarize(
  verdict: QualityScorecardVerdict,
  dimensions: QualityScorecardDimension[],
  score: number,
): string {
  const failing = dimensions.filter((dimension) => dimension.status === 'fail').length;
  const watching = dimensions.filter((dimension) => dimension.status === 'watch').length;
  return `${verdict}: health score ${score}/100 with ${failing} failing and ${watching} watch dimension(s)`;
}

function normalizeMax(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_RISKS;
  return Math.max(1, Math.min(25, Math.floor(value)));
}
