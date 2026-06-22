import type {
  AssessConfidence,
  AssessProofCard,
  AssessTrustMemory,
  AssessTrustMemoryStatus,
} from '../types/assess.js';
import type { DogfoodFeedbackResponse } from '../types/dogfood.js';

export interface ProofCardTrustMemoryInput {
  path?: string;
  responses: DogfoodFeedbackResponse[];
}

export function applyTrustMemory(
  card: AssessProofCard,
  memory: ProofCardTrustMemoryInput | undefined,
): AssessProofCard {
  if (!memory || memory.responses.length === 0) return card;
  const trustMemory = trustMemoryForCard(card, memory);
  if (trustMemory.status === 'none') return { ...card, trustMemory };
  const noisy = trustMemory.status === 'noisy' || trustMemory.status === 'mixed';
  return {
    ...card,
    confidence: noisy ? 'low' : raiseConfidence(card.confidence),
    evidenceGaps: noisy
      ? [
          ...new Set([
            ...card.evidenceGaps,
            'Reviewer feedback marked this signal noisy or false-positive.',
          ]),
        ]
      : card.evidenceGaps,
    trustMemory,
  };
}

export function trustMemoryRank(status: AssessTrustMemoryStatus): number {
  if (status === 'helpful') return 0;
  if (status === 'none') return 1;
  if (status === 'suppressed') return 2;
  if (status === 'mixed') return 3;
  return 4;
}

export function trustMemoryScoreDelta(status: AssessTrustMemoryStatus): number {
  if (status === 'helpful') return 12;
  if (status === 'suppressed') return -4;
  if (status === 'mixed') return -8;
  if (status === 'noisy') return -16;
  return 0;
}

export function trustMemoryRankingReason(status: AssessTrustMemoryStatus): string | undefined {
  if (status === 'helpful') return 'trust memory helpful';
  if (status === 'suppressed') return 'trust memory suppressed';
  if (status === 'mixed') return 'trust memory mixed';
  if (status === 'noisy') return 'trust memory noisy';
  return undefined;
}

export function defaultTrustMemory(feedbackCommand: string): AssessTrustMemory {
  return {
    status: 'none',
    summary: 'No local trust-memory artifact was applied.',
    signals: [],
    feedbackCommand,
  };
}

function trustMemoryForCard(
  card: AssessProofCard,
  memory: ProofCardTrustMemoryInput,
): AssessTrustMemory {
  const helpful = matchingHelpfulSignals(card, memory.responses);
  const noisy = matchingNoisySignals(card, memory.responses);
  const status = trustStatus(helpful.length, noisy.length);
  if (status === 'none') {
    return { ...card.trustMemory, summary: memorySummary(status, memory.path), signals: [] };
  }
  return {
    status,
    summary: memorySummary(status, memory.path),
    signals: [...new Set([...helpful, ...noisy])],
    feedbackCommand: card.feedback.command,
  };
}

function matchingHelpfulSignals(
  card: AssessProofCard,
  responses: DogfoodFeedbackResponse[],
): string[] {
  return responses.flatMap((response) => {
    if (response.useful !== true) return [];
    const signal = response.note ?? '';
    return matchesCard(card, signal) ? [`useful feedback${minutesSuffix(response.minutesSaved)}`] : [];
  });
}

function matchingNoisySignals(
  card: AssessProofCard,
  responses: DogfoodFeedbackResponse[],
): string[] {
  return responses.flatMap((response) => {
    const signals = [
      ...(response.falsePositiveRules ?? []),
      ...(response.noisyFindings ?? []),
      ...(response.useful === false ? [response.note ?? ''] : []),
    ].filter(Boolean);
    return signals.filter((signal) => matchesCard(card, signal)).map((signal) => `noisy: ${signal}`);
  });
}

function matchesCard(card: AssessProofCard, signal: string): boolean {
  const normalizedSignal = normalize(signal);
  if (!normalizedSignal) return false;
  const haystack = normalize([card.id, card.finding, card.source, ...card.files].join(' '));
  if (haystack.includes(normalizedSignal)) return true;
  const signalTokens = contentTokens(normalizedSignal);
  if (signalTokens.length === 0) return false;
  const matches = signalTokens.filter((token) => haystack.includes(token)).length;
  return matches >= Math.min(2, signalTokens.length);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function contentTokens(value: string): string[] {
  const generic = new Set([
    'background',
    'card',
    'edit',
    'false',
    'finding',
    'hotspot',
    'noisy',
    'positive',
    'prevented',
    'proof',
    'signal',
    'useful',
  ]);
  return value
    .split(' ')
    .filter((token) => token.length >= 4 && !generic.has(token));
}

function trustStatus(helpful: number, noisy: number): AssessTrustMemoryStatus {
  if (helpful > 0 && noisy > 0) return 'mixed';
  if (noisy > 0) return 'noisy';
  if (helpful > 0) return 'helpful';
  return 'none';
}

function memorySummary(status: AssessTrustMemoryStatus, filePath: string | undefined): string {
  const location = filePath ? ` from ${filePath}` : '';
  if (status === 'helpful') return `Local trust memory${location} supports this recommendation.`;
  if (status === 'noisy') return `Local trust memory${location} reported noise or a false positive.`;
  if (status === 'mixed') return `Local trust memory${location} has both useful and noisy feedback.`;
  if (status === 'suppressed') return `Local trust memory${location} includes a suppression signal.`;
  return `No matching trust memory${location} was applied.`;
}

function minutesSuffix(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? ` (${Math.round(value)} minutes saved)`
    : '';
}

function raiseConfidence(confidence: AssessConfidence): AssessConfidence {
  return confidence === 'low' ? 'medium' : confidence;
}
