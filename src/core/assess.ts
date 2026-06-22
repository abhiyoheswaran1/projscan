import { computeBugHunt } from './bugHunt.js';
import { readFeedbackFile } from './feedback.js';
import { buildProofCards } from './proofCards.js';
import { computeQualityScorecard } from './qualityScorecard.js';
import { compareRiskDeltaSnapshots, computeRiskDelta } from './riskDelta.js';
import type {
  AssessAnswers,
  AssessMode,
  AssessProofCard,
  AssessReport,
  AssessVerdict,
} from '../types/assess.js';
import type { PreflightVerdict, QualityScorecardVerdict } from '../types.js';

export interface ComputeAssessOptions {
  goal?: string;
  mode?: AssessMode;
  maxCards?: number;
  baselineReport?: AssessReport;
  baselinePath?: string;
  feedbackPath?: string;
}

const DEFAULT_GOAL = 'assess codebase risk and next proof-backed action';

export async function computeAssess(
  rootPath: string,
  options: ComputeAssessOptions = {},
): Promise<AssessReport> {
  const mode = normalizeMode(options.mode);
  const maxCards = mode === 'fix-first' ? Math.min(options.maxCards ?? 2, 2) : options.maxCards;
  const goal = normalizeGoal(options.goal);
  const [quality, bugHunt, trustMemory] = await Promise.all([
    computeQualityScorecard(rootPath, { maxRisks: maxCards ?? 5 }),
    computeBugHunt(rootPath, { maxFindings: maxCards ?? 5 }),
    readOptionalTrustMemory(options.feedbackPath),
  ]);
  const preflightVerdict = bugHunt.evidence.preflightVerdict;
  const initialCards = buildProofCards({
    goal,
    qualityRisks: quality.topRisks,
    bugHuntFindings: bugHunt.fixQueue.length > 0 ? bugHunt.fixQueue : bugHunt.topSuspects,
    maxCards,
    trustMemory,
  });
  const selectedCards = mode === 'fix-first' ? initialCards.slice(0, 2) : initialCards;
  const riskDelta = computeRiskDelta({
    healthScore: quality.health.score,
    qualityVerdict: quality.verdict,
    preflightVerdict,
    proofCards: selectedCards.map((card) => ({
      id: card.id,
      priority: card.priority,
      source: card.source,
    })),
    selectedCardIds: selectedCards.slice(0, mode === 'fix-first' ? 2 : 1).map((card) => card.id),
  });
  const proofCards = selectedCards.map((card) => ({ ...card, riskDelta }));
  const verdict = assessVerdict(quality.verdict, preflightVerdict);
  const answers = buildAnswers({
    proofCards,
    riskDelta,
    preflightVerdict,
  });

  const report: AssessReport = {
    schemaVersion: 1,
    goal,
    mode,
    verdict,
    summary: summarize(verdict, proofCards, riskDelta),
    answers,
    proofCards,
    ...(proofCards[0] ? { fixFirst: proofCards[0] } : {}),
    riskDelta,
    commands: commandsFor(mode),
    feedback: proofCards.map((card) => card.feedback.command),
    sourceVerdicts: {
      quality: quality.verdict,
      preflight: preflightVerdict,
    },
    ...(initialCards.length > proofCards.length ? { truncated: true } : {}),
  };
  if (options.baselineReport) {
    report.baselineComparison = compareRiskDeltaSnapshots({
      previous: options.baselineReport,
      current: report,
      baselinePath: options.baselinePath,
    });
  }
  return report;
}

async function readOptionalTrustMemory(
  feedbackPath: string | undefined,
): Promise<{ path?: string; responses: Awaited<ReturnType<typeof readFeedbackFile>>['responses'] } | undefined> {
  if (!feedbackPath) return undefined;
  try {
    const feedback = await readFeedbackFile(feedbackPath);
    return { path: feedbackPath, responses: feedback.responses };
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) return undefined;
    throw error;
  }
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function buildAnswers(input: {
  proofCards: AssessProofCard[];
  riskDelta: { projectedScore: number; delta: number };
  preflightVerdict: PreflightVerdict;
}): AssessAnswers {
  const first = input.proofCards[0];
  const evidenceSources = first?.evidence.map((entry) => entry.source).join(', ');
  const proofCommands = first?.verification.commands ?? ['projscan doctor --format json'];
  return {
    actuallyRisky: first
      ? `${first.finding} is the top proof-backed risk.`
      : 'No proof-backed risk is currently ranked above baseline verification.',
    whyRisky: first
      ? `Evidence comes from ${evidenceSources || 'local projscan analysis'}.`
      : 'The current assessment did not find a higher-priority local signal.',
    fixFirst: first ? `${first.finding}: ${first.recommendedFix.summary}` : 'Preserve the baseline.',
    safestChange: first
      ? `Use a small bounded change: ${first.recommendedFix.safeChangeShape}`
      : 'Run the listed verification commands before taking larger changes.',
    testsThatProveIt: proofCommands,
    riskRemoved: `Projected risk score improves by ${input.riskDelta.delta} to ${input.riskDelta.projectedScore}.`,
    shipNow:
      input.preflightVerdict === 'block'
        ? 'Do not ship until preflight blockers are resolved.'
        : `Ship only after preflight and proof commands pass; current preflight verdict is ${input.preflightVerdict}.`,
  };
}

function assessVerdict(
  qualityVerdict: QualityScorecardVerdict,
  preflightVerdict: PreflightVerdict,
): AssessVerdict {
  if (preflightVerdict === 'block' || qualityVerdict === 'blocked') return 'blocked';
  if (preflightVerdict === 'caution' || qualityVerdict === 'needs_attention') return 'watch';
  return 'ready';
}

function commandsFor(mode: AssessMode): string[] {
  const commands = [
    'projscan assess --mode fix-first --format json',
    'projscan preflight --mode before_commit --format json',
    'projscan quality-scorecard --format json',
  ];
  if (mode === 'ship-readiness') commands.unshift('projscan preflight --mode before_merge --format json');
  return [...new Set(commands)];
}

function summarize(
  verdict: AssessVerdict,
  proofCards: AssessProofCard[],
  riskDelta: { delta: number },
): string {
  if (proofCards.length === 0) return `${verdict}: no proof-backed action outranks baseline verification`;
  return `${verdict}: ${proofCards.length} proof-backed action(s), projected risk delta +${riskDelta.delta}`;
}

function normalizeMode(value: AssessMode | undefined): AssessMode {
  return value ?? 'standard';
}

function normalizeGoal(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_GOAL;
}
