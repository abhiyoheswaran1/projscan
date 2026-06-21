import { computeRiskDelta } from './riskDelta.js';
import type {
  AssessConfidence,
  AssessProofCard,
  AssessProofSource,
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
}

const DEFAULT_MAX_CARDS = 5;

export function buildProofCards(input: BuildProofCardsInput): AssessProofCard[] {
  const maxCards = normalizeMaxCards(input.maxCards);
  const cards = [
    ...input.bugHuntFindings.map(cardFromBugHuntFinding),
    ...input.qualityRisks.map(cardFromQualityRisk),
  ];
  const deduped = dedupeCards(cards);
  const ranked = rankCards(deduped).slice(0, maxCards);
  return ranked.map((card) => ({
    ...card,
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
  }));
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
    suppression: { command: feedbackCommand, ...input.suppressionHints },
    feedback: { command: feedbackCommand },
    riskDelta: { baselineScore: 0, projectedScore: 0, delta: 0, basis: [] },
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
        a.index - b.index,
    )
    .map((entry) => entry.card);
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
