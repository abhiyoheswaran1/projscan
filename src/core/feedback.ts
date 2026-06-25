import fs from 'node:fs/promises';
import path from 'node:path';

import { classifyFeedbackIntakeText } from './feedbackIntakeClassifier.js';
import type {
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  FeedbackIntakeReport,
  FeedbackSummaryReport,
  FeedbackTemplateResult,
} from '../types/dogfood.js';

export interface CreateFeedbackTemplateOptions {
  force?: boolean;
}

export const FEEDBACK_ARTIFACT_VERSION = 1;
export const MIN_REPEAT_FEEDBACK_PRS = 3;
export const MIN_REPEAT_FEEDBACK_REPOS = 1;

const FEEDBACK_QUESTIONS = [
  'Did the generated PR comment save 10-20 minutes?',
  'How many minutes did projscan save on this PR?',
  'Did projscan prevent a risky edit or missed review step?',
  'Were the owner route and next command clear?',
  'Which rule was noisy, false-positive, or missing a signal?',
] as const;

export async function createFeedbackTemplate(
  filePath: string,
  options: CreateFeedbackTemplateOptions = {},
): Promise<FeedbackTemplateResult> {
  const resolved = path.resolve(filePath);
  if (!options.force) {
    try {
      await fs.access(resolved);
      throw new Error(
        'Feedback file already exists at ' + resolved + '. Pass --force to overwrite it.',
      );
    } catch (error) {
      if (!isNodeErrorCode(error, 'ENOENT')) throw error;
    }
  }

  const artifact = buildTemplate(resolved);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(toStoredFeedback(artifact), null, 2) + '\n', 'utf8');
  return artifact;
}

export async function readFeedbackFile(filePath: string): Promise<DogfoodFeedbackInput> {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return normalizeFeedbackInput(parsed);
}

export async function addFeedbackResponse(
  filePath: string,
  response: DogfoodFeedbackResponse,
): Promise<DogfoodFeedbackInput> {
  const resolved = path.resolve(filePath);
  let artifact: DogfoodFeedbackInput;
  try {
    artifact = await readFeedbackFile(resolved);
  } catch (error) {
    if (!isNodeErrorCode(error, 'ENOENT')) throw error;
    artifact = toStoredFeedback(buildTemplate(resolved));
  }

  const normalized = normalizeFeedbackResponse(response);
  artifact.responses.push(normalized);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  return artifact;
}

export async function summarizeFeedbackFile(filePath: string): Promise<FeedbackSummaryReport> {
  const resolved = path.resolve(filePath);
  const artifact = await readFeedbackFile(resolved);
  return summarizeFeedback(artifact.responses, resolved);
}

export function classifyFeedbackIntake(rawText: string): FeedbackIntakeReport {
  return classifyFeedbackIntakeText(rawText, FEEDBACK_ARTIFACT_VERSION);
}

export function summarizeFeedback(
  responses: DogfoodFeedbackResponse[],
  filePath = '.projscan-feedback.json',
): FeedbackSummaryReport {
  const usefulResponses = responses.filter((response) => response.useful === true).length;
  const minutes = responses.map((response) => response.minutesSaved);
  const totalMinutes = sumNumbers(minutes);
  const distinctRepos = countDistinct(responses.map((response) => response.repo));
  const distinctPrs = countDistinct(responses.map((response) => response.pr));
  const repeatedRepos = countRepeatedRepos(responses);
  const falsePositiveRules = cleanSignals(
    responses.flatMap((response) => response.falsePositiveRules ?? []),
  );
  const missingSignals = cleanSignals(
    responses.flatMap((response) => response.missingSignals ?? []),
  );
  const noisyFindings = cleanSignals(responses.flatMap((response) => response.noisyFindings ?? []));

  return {
    schemaVersion: FEEDBACK_ARTIFACT_VERSION,
    path: filePath,
    responses: responses.length,
    usefulResponses,
    distinctRepos,
    distinctPrs,
    minutesSaved: {
      total: totalMinutes,
      average: responses.length > 0 ? round(totalMinutes / responses.length) : 0,
      max: Math.max(0, ...responses.map((response) => saneNumber(response.minutesSaved))),
    },
    preventedBadEdits: responses.filter((response) => response.preventedBadEdit === true).length,
    ownerRoutingClear: responses.filter((response) => response.ownerRoutingClear === true).length,
    nextCommandClear: responses.filter((response) => response.nextCommandClear === true).length,
    repeatUse: {
      distinctPrs,
      repeatedRepos,
      requiredDistinctPrs: MIN_REPEAT_FEEDBACK_PRS,
      requiredRepeatedRepos: MIN_REPEAT_FEEDBACK_REPOS,
      ready: distinctPrs >= MIN_REPEAT_FEEDBACK_PRS && repeatedRepos >= MIN_REPEAT_FEEDBACK_REPOS,
    },
    falsePositive: {
      totalReports: falsePositiveRules.length,
      noisyRules: countSignals(falsePositiveRules, 'rule'),
      missingSignals: countSignals(missingSignals, 'signal'),
      noisyFindings: countSignals(noisyFindings, 'finding'),
    },
    nextDogfoodCommand: 'projscan dogfood --feedback ' + filePath + ' --format json',
  };
}

function buildTemplate(filePath: string): FeedbackTemplateResult {
  return {
    schemaVersion: FEEDBACK_ARTIFACT_VERSION,
    path: filePath,
    createdAt: new Date().toISOString(),
    questions: [...FEEDBACK_QUESTIONS],
    instructions: [
      'Record one response per real PR review.',
      'Use the same repo with multiple PR URLs when a team comes back and uses projscan again.',
      'Run projscan feedback summary --file ' + filePath + ' --format json before dogfood.',
      'Feed this artifact into projscan dogfood with --feedback ' + filePath + '.',
    ],
    responses: [],
  };
}

function toStoredFeedback(template: FeedbackTemplateResult): DogfoodFeedbackInput {
  return {
    schemaVersion: template.schemaVersion,
    questions: template.questions,
    responses: template.responses,
  };
}

function normalizeFeedbackInput(input: unknown): DogfoodFeedbackInput {
  if (!input || typeof input !== 'object') {
    return {
      schemaVersion: FEEDBACK_ARTIFACT_VERSION,
      questions: [...FEEDBACK_QUESTIONS],
      responses: [],
    };
  }
  const raw = input as DogfoodFeedbackInput;
  return {
    schemaVersion:
      raw.schemaVersion === FEEDBACK_ARTIFACT_VERSION
        ? FEEDBACK_ARTIFACT_VERSION
        : FEEDBACK_ARTIFACT_VERSION,
    questions: Array.isArray(raw.questions)
      ? raw.questions.filter((question) => typeof question === 'string')
      : [...FEEDBACK_QUESTIONS],
    responses: Array.isArray(raw.responses) ? raw.responses.map(normalizeFeedbackResponse) : [],
  };
}

function normalizeFeedbackResponse(
  response: DogfoodFeedbackResponse | unknown,
): DogfoodFeedbackResponse {
  const input =
    response && typeof response === 'object' ? (response as DogfoodFeedbackResponse) : {};
  const normalized: DogfoodFeedbackResponse = {};
  const repo = cleanString(input.repo);
  const pr = cleanString(input.pr);
  const reviewer = cleanString(input.reviewer);
  const note = cleanString(input.note);
  const proofContractId = cleanString(input.proofContractId);
  const proofReceiptStatus = cleanString(input.proofReceiptStatus);
  const proofReviewerDecision = cleanString(input.proofReviewerDecision);
  if (repo) normalized.repo = repo;
  if (pr) normalized.pr = pr;
  if (reviewer) normalized.reviewer = reviewer;
  if (isProofOutcome(input.proofOutcome)) normalized.proofOutcome = input.proofOutcome;
  if (proofContractId) normalized.proofContractId = proofContractId;
  if (proofReceiptStatus) normalized.proofReceiptStatus = proofReceiptStatus;
  if (proofReviewerDecision) normalized.proofReviewerDecision = proofReviewerDecision;
  if (typeof input.useful === 'boolean') normalized.useful = input.useful;
  if (typeof input.preventedBadEdit === 'boolean')
    normalized.preventedBadEdit = input.preventedBadEdit;
  if (typeof input.ownerRoutingClear === 'boolean')
    normalized.ownerRoutingClear = input.ownerRoutingClear;
  if (typeof input.nextCommandClear === 'boolean')
    normalized.nextCommandClear = input.nextCommandClear;
  if (note) normalized.note = note;
  normalized.minutesSaved = saneNumber(input.minutesSaved);
  normalized.falsePositiveRules = cleanSignals(input.falsePositiveRules ?? []);
  normalized.missingSignals = cleanSignals(input.missingSignals ?? []);
  normalized.noisyFindings = cleanSignals(input.noisyFindings ?? []);
  return normalized;
}

function countDistinct(values: Array<string | undefined>): number {
  return new Set(values.map((value) => normalizeKey(value ?? '')).filter(Boolean)).size;
}

function countRepeatedRepos(responses: DogfoodFeedbackResponse[]): number {
  const prsByRepo = new Map<string, Set<string>>();
  for (const response of responses) {
    const repo = normalizeKey(response.repo ?? '');
    const pr = normalizeKey(response.pr ?? '');
    if (!repo || !pr) continue;
    if (!prsByRepo.has(repo)) prsByRepo.set(repo, new Set());
    prsByRepo.get(repo)?.add(pr);
  }
  return [...prsByRepo.values()].filter((prs) => prs.size >= 2).length;
}

function countSignals<T extends 'rule' | 'signal' | 'finding'>(
  values: string[],
  key: T,
): Array<Record<T, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const value of cleanSignals(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ [key]: value, count }) as Record<T, string> & { count: number });
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function cleanSignals(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.toLowerCase() !== 'none');
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isProofOutcome(value: unknown): value is NonNullable<DogfoodFeedbackResponse['proofOutcome']> {
  return (
    value === 'accepted' ||
    value === 'rejected' ||
    value === 'reverted' ||
    value === 'suppressed' ||
    value === 'noisy'
  );
}

function normalizeKey(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/$/, '').trim().toLowerCase();
}

function sumNumbers(values: Array<number | undefined>): number {
  return values.reduce<number>((sum, value) => sum + saneNumber(value), 0);
}

function saneNumber(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
