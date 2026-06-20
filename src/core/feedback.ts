import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  DogfoodFeedbackInput,
  DogfoodFeedbackResponse,
  FeedbackIntakeCategory,
  FeedbackIntakeConfidence,
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
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const category = classifyCategory(lower);
  const signal = primarySignal(category, lower);
  const confidence = confidenceFor(category, lower);
  const taskTitle = taskTitleFor(category, signal);
  const suggestedCommand = commandFor(category, signal);
  const summary = summaryFor(category, signal);
  const agentloopTaskCommand = agentloopCommandFor(category, taskTitle, summary, suggestedCommand);

  return {
    schemaVersion: FEEDBACK_ARTIFACT_VERSION,
    category,
    confidence,
    summary,
    evidence: evidenceFor(category, lower),
    taskTitle,
    suggestedCommand,
    nextCommand: agentloopTaskCommand,
    agentloopTaskCommand,
    followUpCommands: [agentloopTaskCommand, suggestedCommand],
    feedbackResponse: feedbackResponseFor(category, signal, summary),
  };
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

function classifyCategory(text: string): FeedbackIntakeCategory {
  if (
    /\bfalse[- ]positive\b|incorrectly flag|wrongly flag|flagged unused|reported unused|not actually unused/.test(
      text,
    )
  ) {
    return 'false_positive';
  }
  if (
    /\bcaution\b|\bwarning\b/.test(text) &&
    /noise|noisy|background|too many|low[- ]signal|spam/.test(text)
  ) {
    return 'noisy_caution';
  }
  if (
    /missing|not detected|not detect|does not detect|doesn't detect|should detect|misses/.test(
      text,
    ) &&
    /framework|next\.?js|app router|route handler|middleware|koa|hono|fastify|express|sveltekit|astro|remix|request source|ctx\.request/.test(
      text,
    )
  ) {
    return 'missing_framework_rule';
  }
  if (
    /docs|readme|output|wording|message|copy/.test(text) &&
    /confusing|unclear|bigger than|overclaim|overstate|sounds bigger|not demonstrated/.test(text)
  ) {
    return 'confusing_docs_output';
  }
  if (/\buseful\b|saved .*minute|prevented|caught|helped|trusted|clear next/.test(text)) {
    return 'useful_signal';
  }
  return 'uncategorized';
}

function primarySignal(category: FeedbackIntakeCategory, text: string): string {
  if (category === 'false_positive') {
    if (/unused[- ]exports?/.test(text)) return 'unused-exports';
    if (/unused[- ]dependenc/.test(text)) return 'unused-dependencies';
    if (/dead[- ]code/.test(text)) return 'dead-code';
    if (/dataflow|taint|source-to-sink/.test(text)) return 'dataflow';
    return 'rule false positive';
  }
  if (category === 'missing_framework_rule') {
    if (/koa/.test(text)) return 'Koa';
    if (/hono/.test(text)) return 'Hono';
    if (/fastify/.test(text)) return 'Fastify';
    if (/express/.test(text)) return 'Express';
    if (/next\.?js|app router|middleware|route handler/.test(text)) return 'Next.js';
    if (/sveltekit/.test(text)) return 'SvelteKit';
    if (/astro/.test(text)) return 'Astro';
    if (/remix/.test(text)) return 'Remix';
    return 'framework request source';
  }
  if (category === 'noisy_caution') return 'caution';
  if (category === 'confusing_docs_output') return 'docs/output';
  if (category === 'useful_signal') return 'useful workflow';
  return 'unclassified feedback';
}

function confidenceFor(category: FeedbackIntakeCategory, text: string): FeedbackIntakeConfidence {
  if (category === 'uncategorized') return 'low';
  const strongSignals = [
    /\bfalse[- ]positive\b/,
    /unused[- ]exports?/,
    /\bcaution\b.*(?:noise|noisy|background)|(?:noise|noisy|background).*\bcaution\b/,
    /ctx\.request|app router|route handler|middleware/,
    /saved .*minute|prevented/,
  ];
  return strongSignals.some((pattern) => pattern.test(text)) ? 'high' : 'medium';
}

function taskTitleFor(category: FeedbackIntakeCategory, signal: string): string {
  switch (category) {
    case 'false_positive':
      return 'Fix false-positive feedback: ' + signal;
    case 'noisy_caution':
      return 'Reduce noisy caution output';
    case 'missing_framework_rule':
      return 'Add missing framework rule: ' + signal;
    case 'confusing_docs_output':
      return 'Clarify confusing docs or output';
    case 'useful_signal':
      return 'Preserve useful feedback signal';
    case 'uncategorized':
      return 'Triage unclassified feedback';
  }
}

function commandFor(category: FeedbackIntakeCategory, signal: string): string {
  if (category === 'false_positive' && signal === 'unused-exports') {
    return 'npm test -- tests/analyzers/deadCodeCheck.test.ts tests/core/importGraph.test.ts';
  }
  switch (category) {
    case 'false_positive':
      return 'npm test -- tests/analyzers tests/core/importGraph.test.ts';
    case 'noisy_caution':
      return 'npm test -- tests/core/preflight*.test.ts tests/core/releaseEvidence.test.ts';
    case 'missing_framework_rule':
      return 'npm test -- tests/core/dataflow.test.ts tests/analyzers/securityCheck.test.ts';
    case 'confusing_docs_output':
      return 'npm test -- tests/docs tests/cli/startConsoleGuidance.test.ts';
    case 'useful_signal':
      return 'projscan feedback summary --file .projscan-feedback.json --format json';
    case 'uncategorized':
      return 'projscan feedback summary --file .projscan-feedback.json --format json';
  }
}

function summaryFor(category: FeedbackIntakeCategory, signal: string): string {
  switch (category) {
    case 'false_positive':
      return 'Classified as false-positive feedback for ' + signal + '.';
    case 'noisy_caution':
      return 'Classified as caution noise that should be ranked or grouped.';
    case 'missing_framework_rule':
      return 'Classified as missing framework coverage for ' + signal + '.';
    case 'confusing_docs_output':
      return 'Classified as confusing docs or output wording.';
    case 'useful_signal':
      return 'Classified as a useful workflow signal to preserve.';
    case 'uncategorized':
      return 'Classified as feedback that needs maintainer triage.';
  }
}

function evidenceFor(category: FeedbackIntakeCategory, text: string): string[] {
  const evidence: string[] = [];
  if (/false[- ]positive|flagged unused|reported unused/.test(text))
    evidence.push('false-positive wording');
  if (/unused[- ]exports?/.test(text)) evidence.push('unused-exports signal');
  if (/caution|warning/.test(text)) evidence.push('caution wording');
  if (/noise|noisy|background/.test(text)) evidence.push('noise wording');
  if (/koa|hono|fastify|express|next\.?js|sveltekit|astro|remix/.test(text))
    evidence.push('framework wording');
  if (/docs|readme|output|wording|message/.test(text)) evidence.push('docs/output wording');
  if (/useful|saved .*minute|prevented|caught|helped/.test(text))
    evidence.push('usefulness wording');
  if (evidence.length === 0) evidence.push(category);
  return evidence;
}

function feedbackResponseFor(
  category: FeedbackIntakeCategory,
  signal: string,
  summary: string,
): DogfoodFeedbackResponse {
  const response: DogfoodFeedbackResponse = {
    reviewer: 'agent-intake',
    useful: category === 'useful_signal',
    minutesSaved: 0,
    note: summary,
  };
  if (category === 'false_positive') response.falsePositiveRules = [signal];
  if (category === 'missing_framework_rule') response.missingSignals = [signal];
  if (category === 'noisy_caution') response.noisyFindings = [signal];
  if (category === 'confusing_docs_output') response.noisyFindings = [signal];
  return response;
}

function agentloopCommandFor(
  category: FeedbackIntakeCategory,
  taskTitle: string,
  summary: string,
  suggestedCommand: string,
): string {
  const taskType = category === 'useful_signal' ? 'tests' : 'bugfix';
  const problem =
    'Reviewer feedback classified as ' +
    category +
    ': ' +
    summary +
    ' Preserve the raw signal in local feedback evidence and avoid broad product scope.';
  const outcome =
    category === 'useful_signal'
      ? 'Keep the useful workflow covered by focused tests or docs so later changes do not regress it.'
      : 'Reproduce and fix the feedback signal, or document the remaining limitation with focused verification.';
  return [
    'npm exec agentloop -- create-task',
    '--type ' + taskType,
    '--title ' + shellQuote(taskTitle),
    '--problem ' + shellQuote(problem),
    '--outcome ' + shellQuote(outcome),
    '--acceptance ' + shellQuote('The feedback signal is addressed with a focused test or documented as deferred.'),
    '--verify-command ' + shellQuote(suggestedCommand),
    '--rollback ' + shellQuote('Revert the focused feedback fix if verification fails.'),
  ].join(' ');
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
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
  if (repo) normalized.repo = repo;
  if (pr) normalized.pr = pr;
  if (reviewer) normalized.reviewer = reviewer;
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
