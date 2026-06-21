import type { PreflightVerdict, QualityScorecardVerdict, WorkplanPriority } from '../types.js';
import type {
  AssessBaselineComparison,
  AssessReport,
  RiskDeltaSnapshot,
} from '../types/assess.js';

export interface RiskDeltaInput {
  healthScore: number;
  qualityVerdict: QualityScorecardVerdict;
  preflightVerdict: PreflightVerdict;
  proofCards: Array<{ id: string; priority: WorkplanPriority; source: string }>;
  selectedCardIds?: string[];
}

export function computeRiskDelta(input: RiskDeltaInput): RiskDeltaSnapshot {
  const basis: string[] = [`health score ${clamp(input.healthScore)}`];
  const qualityPenalty = qualityVerdictPenalty(input.qualityVerdict);
  const preflightPenalty = preflightVerdictPenalty(input.preflightVerdict);
  const cardPenalty = input.proofCards.reduce((sum, card) => sum + priorityPenalty(card.priority), 0);

  if (qualityPenalty > 0) basis.push(`quality verdict ${input.qualityVerdict} penalty ${qualityPenalty}`);
  if (preflightPenalty > 0)
    basis.push(`preflight verdict ${input.preflightVerdict} penalty ${preflightPenalty}`);
  if (cardPenalty > 0) basis.push(`${input.proofCards.length} proof card risk penalty ${cardPenalty}`);

  const baselineScore = clamp(input.healthScore - qualityPenalty - preflightPenalty - cardPenalty);
  const selected = new Set(input.selectedCardIds ?? []);
  const selectedCards = input.proofCards.filter((card) => selected.has(card.id));
  const improvement = selectedCards.reduce(
    (sum, card) => sum + expectedImprovement(card.priority),
    0,
  );

  for (const card of selectedCards) {
    basis.push(`${card.priority} ${card.source} improvement ${expectedImprovement(card.priority)}`);
  }

  const projectedScore = clamp(baselineScore + improvement);
  return {
    baselineScore,
    projectedScore,
    delta: projectedScore - baselineScore,
    basis,
  };
}

export function compareRiskDeltaSnapshots(input: {
  previous: Pick<AssessReport, 'riskDelta'>;
  current: Pick<AssessReport, 'riskDelta'>;
  baselinePath?: string;
}): AssessBaselineComparison {
  const previousScore = clamp(input.previous.riskDelta.projectedScore);
  const currentScore = clamp(input.current.riskDelta.projectedScore);
  const delta = currentScore - previousScore;
  const suffix = input.baselinePath ? ` since ${input.baselinePath}` : '';
  const direction = delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'is unchanged';
  const amount = delta === 0 ? '' : ` by ${Math.abs(delta)}`;
  return {
    previousScore,
    currentScore,
    delta,
    ...(input.baselinePath ? { baselinePath: input.baselinePath } : {}),
    summary: `risk score ${direction}${amount}${suffix}`,
  };
}

function qualityVerdictPenalty(verdict: QualityScorecardVerdict): number {
  if (verdict === 'blocked') return 30;
  if (verdict === 'needs_attention') return 15;
  if (verdict === 'healthy') return 4;
  return 0;
}

function preflightVerdictPenalty(verdict: PreflightVerdict): number {
  if (verdict === 'block') return 30;
  if (verdict === 'caution') return 12;
  return 0;
}

function priorityPenalty(priority: WorkplanPriority): number {
  if (priority === 'p0') return 12;
  if (priority === 'p1') return 8;
  return 3;
}

function expectedImprovement(priority: WorkplanPriority): number {
  if (priority === 'p0') return 18;
  if (priority === 'p1') return 12;
  return 5;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
