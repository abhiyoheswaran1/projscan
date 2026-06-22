import { computeRiskDelta } from './riskDelta.js';
import {
  applyTrustMemory,
  defaultTrustMemory,
  trustMemoryRank,
  trustMemoryRankingReason,
  trustMemoryScoreDelta,
  type ProofCardTrustMemoryInput,
} from './proofCardTrustMemory.js';
import type {
  AssessAgentHandoff,
  AssessConfidence,
  AssessEvidenceStrength,
  AssessProofCard,
  AssessProofSource,
  AssessRanking,
  RiskDeltaSnapshot,
} from '../types/assess.js';
import type { BugHuntFinding, QualityScorecardRisk, WorkplanPriority } from '../types.js';
import type { WorkplanEvidence } from '../types/workplan.js';

export interface BuildProofCardsInput {
  goal?: string;
  qualityRisks: QualityScorecardRisk[];
  bugHuntFindings: BugHuntFinding[];
  maxCards?: number;
  riskDelta?: RiskDeltaSnapshot;
  trustMemory?: ProofCardTrustMemoryInput;
}

const DEFAULT_MAX_CARDS = 5;

export function buildProofCards(input: BuildProofCardsInput): AssessProofCard[] {
  const maxCards = normalizeMaxCards(input.maxCards);
  const cards = [
    ...input.bugHuntFindings.map(cardFromBugHuntFinding),
    ...input.qualityRisks.map(cardFromQualityRisk),
  ].map((card) => applyTrustMemory(card, input.trustMemory));
  const deduped = dedupeCards(cards);
  const ranked = rankCards(deduped).slice(0, maxCards);
  return ranked.map((card, index) => {
    const ranking = buildRanking(card, index + 1);
    return {
      ...card,
      ranking,
      confidenceReason: confidenceReasonFor(card.confidence, card.evidenceStrength, card.evidenceGaps),
      riskDelta:
        input.riskDelta ??
        computeRiskDelta({
          healthScore: 100,
          qualityVerdict: 'needs_attention',
          preflightVerdict: 'caution',
          proofCards: ranked.map((entry) => ({
            id: entry.id,
            priority: entry.priority,
            source: entry.source,
          })),
          selectedCardIds: [card.id],
        }),
    };
  });
}

function cardFromBugHuntFinding(finding: BugHuntFinding): AssessProofCard {
  const id = `proof-${finding.id}`;
  return baseCard({
    id,
    priority: finding.priority,
    source: finding.source,
    finding: finding.title,
    whyItMatters: finding.why,
    files: finding.files,
    evidence: finding.evidence.map((entry) => ({
      source: String(entry.source),
      detail: entry.message,
      ...(entry.file ? { file: entry.file } : {}),
      ...(entry.tool ? { command: entry.tool } : {}),
    })),
    commands: [...new Set([...finding.verification.commands, 'projscan bug-hunt --format json'])],
    affectedAreas: affectedAreasForSource(finding.source),
    fixSummary: fixSummaryForSource(finding.source, finding.title),
    safeChangeShape: safeChangeShapeForSource(finding.source),
    expected: finding.verification.expected,
    confidence: finding.source === 'doctor' ? 'high' : 'medium',
    suppressionHints: suppressionHintsForFinding(finding),
  });
}

function cardFromQualityRisk(risk: QualityScorecardRisk): AssessProofCard {
  const id = `proof-${risk.id}`;
  return baseCard({
    id,
    priority: risk.priority,
    source: risk.source,
    finding: risk.title,
    whyItMatters: whyQualityRiskMatters(risk),
    files: risk.files,
    evidence: [
      {
        source: 'quality-scorecard',
        detail: risk.title,
        ...(risk.files[0] ? { file: risk.files[0] } : {}),
        command: risk.command,
      },
    ],
    commands: [
      ...new Set([
        risk.command,
        ...(risk.source === 'hotspot' ? [simulateCommandForRisk(risk)] : []),
        'projscan quality-scorecard --format json',
      ]),
    ],
    affectedAreas: affectedAreasForSource(risk.source),
    fixSummary: fixSummaryForSource(risk.source, risk.title),
    safeChangeShape: safeChangeShapeForSource(risk.source),
    expected: 'The proof card remains explainable, the relevant risk drops, and tests pass.',
    confidence: risk.source === 'issue' ? 'high' : 'medium',
  });
}

function baseCard(input: {
  id: string;
  priority: WorkplanPriority;
  source: AssessProofSource;
  finding: string;
  whyItMatters: string;
  files: string[];
  evidence: AssessProofCard['evidence'];
  commands: string[];
  affectedAreas: string[];
  fixSummary: string;
  safeChangeShape: string;
  expected: string;
  confidence: AssessConfidence;
  suppressionHints?: {
    inlineHint?: string;
    configHint?: string;
  };
}): AssessProofCard {
  const feedbackCommand = feedbackCommandFor(input.id);
  const evidenceStrength = evidenceStrengthFor(input);
  const evidenceGaps = evidenceGapsFor(input, evidenceStrength);
  const trustMemory = defaultTrustMemory(feedbackCommand);
  const agentHandoff = agentHandoffFor(input, input.commands);
  return {
    id: input.id,
    priority: input.priority,
    source: input.source,
    finding: input.finding,
    whyItMatters: input.whyItMatters,
    files: input.files,
    evidence: input.evidence,
    impact: {
      commands: input.commands,
      affectedAreas: input.affectedAreas,
      likelyFiles: input.files,
    },
    recommendedFix: {
      summary: input.fixSummary,
      safeChangeShape: input.safeChangeShape,
    },
    verification: {
      commands: input.commands,
      expected: input.expected,
    },
    confidence: input.confidence,
    confidenceReason: confidenceReasonFor(input.confidence, evidenceStrength, evidenceGaps),
    evidenceStrength,
    evidenceGaps,
    ranking: {
      rank: 0,
      score: 0,
      reasons: rankingReasonsFor(input, evidenceStrength),
    },
    trustMemory,
    agentHandoff,
    suppression: { command: feedbackCommand, ...input.suppressionHints },
    feedback: { command: feedbackCommand },
    riskDelta: { baselineScore: 0, projectedScore: 0, delta: 0, basis: [] },
  };
}

function evidenceStrengthFor(input: {
  source: AssessProofSource;
  files: string[];
  evidence: AssessProofCard['evidence'];
  commands: string[];
}): AssessEvidenceStrength {
  const sources = [...new Set(input.evidence.map((entry) => entry.source).filter(Boolean))].sort();
  const reasons: string[] = [];
  let score = 0;

  if (sources.length > 0) {
    score += Math.min(45, sources.length * 25);
    reasons.push(`${sources.length} local evidence source(s)`);
  }
  if (input.commands.length > 0) {
    score += Math.min(20, input.commands.length * 8);
    reasons.push(`${input.commands.length} proof command(s)`);
  }
  if (input.files.length > 0) {
    score += 10;
    reasons.push(`${input.files.length} scoped file(s)`);
  }
  if (input.source === 'doctor' || sources.includes('doctor')) {
    score += 25;
    reasons.push('doctor-backed finding');
  }
  if (input.commands.some((command) => /\b(?:npm test|vitest|test)\b/.test(command))) {
    score += 10;
    reasons.push('test command included');
  }

  const clamped = Math.max(0, Math.min(100, score));
  const level = clamped >= 75 ? 'strong' : clamped >= 40 ? 'moderate' : 'thin';
  return { level, score: clamped, sources, reasons };
}

function evidenceGapsFor(
  input: {
    source: AssessProofSource;
    commands: string[];
    evidence: AssessProofCard['evidence'];
  },
  strength: AssessEvidenceStrength,
): string[] {
  const sources = new Set(strength.sources);
  const gaps: string[] = [];
  if (input.source !== 'doctor' && !sources.has('doctor')) {
    gaps.push('No direct bug-hunt or doctor finding is attached.');
  }
  if (!input.commands.some((command) => /\b(?:npm test|vitest|test)\b/.test(command))) {
    gaps.push('No direct test command is attached.');
  }
  if (input.evidence.length <= 1 && strength.level !== 'strong') {
    gaps.push('Only one evidence item supports this card.');
  }
  return [...new Set(gaps)];
}

function confidenceReasonFor(
  confidence: AssessConfidence,
  strength: AssessEvidenceStrength,
  gaps: string[],
): string {
  const gapText =
    gaps.length > 0 ? ` Evidence gaps: ${gaps.join(' ')}` : ' No evidence gaps are currently blocking action.';
  return `${confidence} confidence because evidence strength is ${strength.level} (${strength.score}/100).${gapText}`;
}

function agentHandoffFor(
  input: {
    finding: string;
    files: string[];
    affectedAreas: string[];
    fixSummary: string;
    safeChangeShape: string;
    expected: string;
  },
  commands: string[],
): AssessAgentHandoff {
  const files = input.files.length > 0 ? input.files : ['repo'];
  return {
    title: `Reduce risk: ${input.finding}`,
    problem: `${input.finding}. ${input.fixSummary}`,
    scope: [...new Set([...input.affectedAreas, ...files])],
    files,
    constraints: [
      'Keep the change bounded to this proof card.',
      'Preserve local-first behavior and do not read or print secret values.',
      'Do not release, publish, deploy, push, merge, tag, or bump versions from this packet.',
      input.safeChangeShape,
    ],
    verificationCommands: commands,
    doneCriteria: [input.expected, 'All listed verification commands pass.'],
    rollback: `Revert the focused files for this proof card: ${files.join(', ')}.`,
  };
}

function suppressionHintsForFinding(
  finding: BugHuntFinding,
): { inlineHint?: string; configHint?: string } | undefined {
  const evidence = finding.evidence.find((entry) => entry.issueId || entry.file);
  const ruleId = ruleIdFromEvidence(evidence);
  const file = evidence?.file ?? finding.files[0];
  if (!ruleId || !file) return undefined;
  return {
    ...(evidence && 'line' in evidence && typeof evidence.line === 'number'
      ? { inlineHint: `// projscan-ignore-line ${ruleId} -- reason` }
      : {}),
    configHint: `"suppress": { "${ruleId}": ["${file}"] }`,
  };
}

function ruleIdFromEvidence(evidence: WorkplanEvidence | undefined): string | undefined {
  const issueId = evidence?.issueId;
  if (!issueId) return undefined;
  if (issueId === 'hardcoded-secret' || issueId.startsWith('hardcoded-secret-'))
    return 'hardcoded-secret';
  return issueId;
}

function dedupeCards(cards: AssessProofCard[]): AssessProofCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.files[0] ?? card.id}:${card.finding}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankCards(cards: AssessProofCard[]): AssessProofCard[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        priorityRank(a.card.priority) - priorityRank(b.card.priority) ||
        sourceRank(a.card.source) - sourceRank(b.card.source) ||
        trustMemoryRank(a.card.trustMemory.status) - trustMemoryRank(b.card.trustMemory.status) ||
        a.index - b.index,
    )
    .map((entry) => entry.card);
}

function buildRanking(card: AssessProofCard, rank: number): AssessRanking {
  const score =
    (card.priority === 'p0' ? 100 : card.priority === 'p1' ? 80 : 50) +
    (card.source === 'doctor' || card.source === 'issue' ? 20 : 0) +
    Math.round(card.evidenceStrength.score / 5) +
    trustMemoryScoreDelta(card.trustMemory.status);
  return {
    rank,
    score,
    reasons: rankingReasonsFor(card, card.evidenceStrength),
  };
}

function rankingReasonsFor(
  input: {
    priority: WorkplanPriority;
    source: AssessProofSource;
    confidence?: AssessConfidence;
    trustMemory?: AssessProofCard['trustMemory'];
  },
  strength: AssessEvidenceStrength,
): string[] {
  const reasons = [`priority ${input.priority}`, `source ${input.source}`, `evidence ${strength.level}`];
  if (input.confidence) reasons.push(`confidence ${input.confidence}`);
  const trustReason = input.trustMemory
    ? trustMemoryRankingReason(input.trustMemory.status)
    : undefined;
  if (trustReason) reasons.push(trustReason);
  return reasons;
}

function affectedAreasForSource(source: AssessProofSource): string[] {
  if (source === 'doctor') return ['health'];
  if (source === 'hotspot') return ['maintainability'];
  if (source === 'coordination' || source === 'session') return ['coordination'];
  if (source === 'preflight') return ['ship-readiness'];
  return ['quality'];
}

function whyQualityRiskMatters(risk: QualityScorecardRisk): string {
  if (risk.source === 'hotspot') {
    return 'This file concentrates churn, complexity, issue, or ownership risk and deserves a bounded review before broad changes.';
  }
  if (risk.source === 'coordination') {
    return 'Coordination risk can cause agents or engineers to overwrite each other or validate the wrong state.';
  }
  return 'This issue-backed risk is visible in the project health signal and can affect confidence in daily gates.';
}

function fixSummaryForSource(source: AssessProofSource, title: string): string {
  if (source === 'hotspot') return `Reduce the risk behind "${title}" with one focused extraction or test first.`;
  if (source === 'coordination') return 'Resolve the coordination conflict before changing shared files.';
  if (source === 'session') return 'Review touched files and clear active session conflicts before continuing.';
  if (source === 'preflight') return 'Close the preflight blocker or document the required manual sign-off.';
  return `Address "${title}" with the smallest change that removes the finding.`;
}

function safeChangeShapeForSource(source: AssessProofSource): string {
  if (source === 'hotspot') {
    return 'Inspect the file first, extract one pure helper or add one missing regression test, then rerun the listed proof commands.';
  }
  if (source === 'coordination' || source === 'session') {
    return 'Synchronize ownership, re-run session or coordinate evidence, then continue with one owner for the file.';
  }
  if (source === 'preflight') {
    return 'Fix concrete blockers first; for review-only scale, collect sign-off before merge or release.';
  }
  return 'Make one narrow code or config change, avoid unrelated cleanup, and rerun the listed proof commands.';
}

function feedbackCommandFor(id: string): string {
  return `projscan feedback intake --text "${id}: false positive because ..." --format json`;
}

function simulateCommandForRisk(risk: QualityScorecardRisk): string {
  return `projscan simulate --plan "Reduce the risk behind ${risk.title.replace(/["\\]/g, '\\$&')}" --format json`;
}

function priorityRank(priority: WorkplanPriority): number {
  if (priority === 'p0') return 0;
  if (priority === 'p1') return 1;
  return 2;
}

function sourceRank(source: AssessProofSource): number {
  if (source === 'doctor' || source === 'issue') return 0;
  if (source === 'preflight') return 1;
  if (source === 'hotspot') return 2;
  if (source === 'coordination' || source === 'session') return 3;
  return 4;
}

function normalizeMaxCards(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_CARDS;
  return Math.max(1, Math.min(25, Math.floor(value)));
}
