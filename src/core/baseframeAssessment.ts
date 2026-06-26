import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { computeAssess } from './assess.js';
import { detectFrameworks } from './frameworkDetector.js';
import { detectLanguages } from './languageDetector.js';
import { scanRepository } from './repositoryScanner.js';
import { atomicWriteFile } from '../utils/atomicWrite.js';
import type { AssessProofCard, AssessReport } from '../types/assess.js';
import type {
  BaseframeAgentWorkflowV1,
  ProjScanAssessmentPriority,
  ProjScanAssessmentRiskSeverity,
  ProjScanAssessmentV1,
  ProjScanAssessmentVerdict,
} from '../types/baseframe.js';
import type { FrameworkResult, LanguageBreakdown, ScanResult } from '../types/scanning.js';

export type { BaseframeAgentWorkflowV1, ProjScanAssessmentV1 } from '../types/baseframe.js';

export interface CreateBaseframeAssessmentOptions {
  root: string;
  taskId: string;
  intent: string;
  outputPath?: string;
}

interface BaseframeSignals {
  assess?: AssessReport;
  scan?: ScanResult;
  languages?: LanguageBreakdown;
  frameworks?: FrameworkResult;
  limitations: string[];
}

interface RepositoryMetadata {
  root: string;
  branch?: string;
  commit?: string;
}

const execFileAsync = promisify(execFile);
const TASK_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,126}[A-Za-z0-9])?$/;
const ASSESSMENT_FILE = 'projscan-assessment.json';
const BASEFRAME_DIR = '.baseframe';
const EVIDENCE_DIR = 'evidence';

let cachedProducerVersion: string | undefined;

export async function createBaseframeAssessment(
  options: CreateBaseframeAssessmentOptions,
): Promise<ProjScanAssessmentV1> {
  const root = path.resolve(options.root);
  validateTaskId(options.taskId);
  const intent = normalizeIntent(options.intent);
  const outputPath = resolveAssessmentOutputPath(root, options.taskId, options.outputPath);
  const generatedAt = new Date().toISOString();
  const version = await readProducerVersion();
  const [signals, repository] = await Promise.all([
    collectSignals(root, intent),
    readRepositoryMetadata(root),
  ]);

  const assessment = buildAssessment({
    taskId: options.taskId,
    intent,
    generatedAt,
    version,
    repository,
    signals,
  });

  await prepareAssessmentWrite(root, options.taskId, outputPath);
  await assertWritableAssessmentOutput(outputPath, options.taskId);
  await atomicWriteJson(outputPath, assessment);
  await updateWorkflowManifest({
    root,
    taskId: options.taskId,
    intent,
    assessmentPath: relativeRepositoryPath(root, outputPath),
    version,
    updatedAt: generatedAt,
  });

  return assessment;
}

function buildAssessment(input: {
  taskId: string;
  intent: string;
  generatedAt: string;
  version: string;
  repository: RepositoryMetadata;
  signals: BaseframeSignals;
}): ProjScanAssessmentV1 {
  const verdict = mapVerdict(input.signals.assess);
  const summary = summarizeAssessment(verdict, input.signals);
  const repositoryType = describeRepositoryType(input.signals.languages, input.signals.frameworks);
  const proofCards = input.signals.assess?.proofCards ?? [];

  return {
    schemaVersion: '1.0',
    kind: 'projscan-assessment',
    producer: {
      name: 'projscan',
      version: input.version,
    },
    taskId: input.taskId,
    intent: input.intent,
    generatedAt: input.generatedAt,
    repository: input.repository,
    verdict,
    summary,
    ...(repositoryType ? { repositoryType } : {}),
    impactedAreas: buildImpactedAreas(proofCards),
    reviewFocus: buildReviewFocus(proofCards),
    risks: buildRisks(proofCards, verdict),
    suggestedChecks: buildSuggestedChecks(input.signals.assess, verdict),
  };
}

async function collectSignals(root: string, intent: string): Promise<BaseframeSignals> {
  const limitations: string[] = [];
  const [assessResult, scanResult] = await Promise.allSettled([
    computeAssess(root, { goal: intent }),
    scanRepository(root),
  ]);

  const assess = settledValue(assessResult);
  if (!assess) limitations.push('assess report unavailable');

  const scan = settledValue(scanResult);
  if (!scan) limitations.push('repository scan unavailable');

  let languages: LanguageBreakdown | undefined;
  let frameworks: FrameworkResult | undefined;
  if (scan) {
    try {
      languages = detectLanguages(scan.files);
    } catch {
      limitations.push('language detection unavailable');
    }
    try {
      frameworks = await detectFrameworks(root, scan.files);
    } catch {
      limitations.push('framework detection unavailable');
    }
  }

  return { assess, scan, languages, frameworks, limitations };
}

function settledValue<T>(result: PromiseSettledResult<T | undefined>): T | undefined {
  return result.status === 'fulfilled' ? result.value : undefined;
}

function mapVerdict(assess: AssessReport | undefined): ProjScanAssessmentVerdict {
  if (!assess) return 'unknown';
  const preflight = assess.sourceVerdicts?.preflight;
  if (preflight === 'block') return 'block';
  if (preflight === 'caution') return 'caution';
  if (preflight === 'proceed') return 'proceed';
  if (assess.proofCards.length === 0) return 'unknown';
  if (assess.verdict === 'blocked') return 'block';
  if (assess.verdict === 'watch') return 'caution';
  if (assess.verdict === 'ready') return 'proceed';
  return 'unknown';
}

function summarizeAssessment(verdict: ProjScanAssessmentVerdict, signals: BaseframeSignals): string {
  if (verdict === 'unknown') {
    const reason =
      signals.limitations.length > 0
        ? signals.limitations.join('; ')
        : 'no source verdicts or review-focus evidence were available';
    return `unknown: ProjScan assessment is limited because ${reason}.`;
  }
  const baseSummary = signals.assess?.summary ?? 'local ProjScan signals were mapped to Baseframe';
  return `${verdict}: ${baseSummary}`;
}

function describeRepositoryType(
  languages: LanguageBreakdown | undefined,
  frameworks: FrameworkResult | undefined,
): string | undefined {
  const primary = languages?.primary && languages.primary !== 'Unknown' ? languages.primary : '';
  const frameworkNames =
    frameworks?.frameworks.map((framework) => framework.name).sort((a, b) => a.localeCompare(b)) ??
    [];
  const packageManager =
    frameworks?.packageManager && frameworks.packageManager !== 'unknown'
      ? frameworks.packageManager
      : '';
  const details =
    frameworkNames.length > 0 && packageManager
      ? `${frameworkNames.join(', ')}; ${packageManager}`
      : [...frameworkNames, packageManager].filter(Boolean).join(', ');

  if (!primary && !details) return undefined;
  if (!primary) return `Repository (${details})`;
  return details ? `${primary} repository (${details})` : `${primary} repository`;
}

function buildImpactedAreas(
  proofCards: AssessProofCard[],
): ProjScanAssessmentV1['impactedAreas'] {
  const areas = new Map<string, { paths: Set<string>; reasons: Set<string> }>();
  for (const card of proofCards) {
    for (const file of normalizeFileList(card.files)) {
      const areaName = file.split('/')[0] || file;
      const area = areas.get(areaName) ?? { paths: new Set<string>(), reasons: new Set<string>() };
      area.paths.add(file);
      area.reasons.add(card.finding);
      areas.set(areaName, area);
    }
  }

  return [...areas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, area]) => ({
      name,
      paths: [...area.paths].sort((a, b) => a.localeCompare(b)),
      reason: [...area.reasons].sort((a, b) => a.localeCompare(b)).join('; '),
    }));
}

function buildReviewFocus(proofCards: AssessProofCard[]): ProjScanAssessmentV1['reviewFocus'] {
  const focus = new Map<string, { priority: ProjScanAssessmentPriority; reasons: Set<string> }>();
  for (const card of proofCards) {
    for (const file of normalizeFileList(card.files)) {
      const current = focus.get(file);
      const priority = strongerPriority(current?.priority, mapPriority(card.priority));
      const reasons = current?.reasons ?? new Set<string>();
      reasons.add(card.finding);
      reasons.add(card.whyItMatters);
      focus.set(file, { priority, reasons });
    }
  }

  return [...focus.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, entry]) => ({
      path: file,
      priority: entry.priority,
      reasons: [...entry.reasons].filter(Boolean),
    }));
}

function buildRisks(
  proofCards: AssessProofCard[],
  verdict: ProjScanAssessmentVerdict,
): ProjScanAssessmentV1['risks'] {
  return proofCards.map((card) => {
    const files = normalizeFileList(card.files);
    return {
      id: card.id,
      severity: riskSeverity(verdict, card.priority),
      category: card.source,
      message: card.finding,
      ...(files.length > 0 ? { files } : {}),
      ...(card.recommendedFix.summary ? { suggestedAction: card.recommendedFix.summary } : {}),
    };
  });
}

function buildSuggestedChecks(
  assess: AssessReport | undefined,
  verdict: ProjScanAssessmentVerdict,
): ProjScanAssessmentV1['suggestedChecks'] {
  if (!assess) return [];
  if (verdict === 'unknown' && assess.proofCards.length === 0 && !assess.sourceVerdicts) return [];
  const checks = new Map<string, { command: string; reason: string; required: boolean }>();
  const proofReasons = new Map<string, string>();
  for (const card of assess.proofCards) {
    for (const command of card.verification.commands) {
      proofReasons.set(command, `Proof-card verification for ${card.finding}.`);
    }
  }

  for (const command of assess.answers.testsThatProveIt) {
    checks.set(command, {
      command,
      reason: proofReasons.get(command) ?? reasonForAssessmentCommand(command),
      required: true,
    });
  }
  for (const [command, reason] of proofReasons) {
    if (!checks.has(command)) checks.set(command, { command, reason, required: true });
  }
  for (const command of assess.commands) {
    if (!checks.has(command)) {
      checks.set(command, {
        command,
        reason: 'ProjScan assessment follow-up.',
        required: false,
      });
    }
  }
  return [...checks.values()];
}

function reasonForAssessmentCommand(command: string): string {
  if (command === 'projscan doctor --format json') return 'Confirms the issue queue after fixes.';
  if (command.startsWith('projscan preflight ')) return 'Confirms preflight readiness.';
  return 'Assessment verification command.';
}

function normalizeFileList(files: string[]): string[] {
  return [...new Set(files.map(normalizeReportPath).filter((file) => file.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeReportPath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

function mapPriority(priority: AssessProofCard['priority']): ProjScanAssessmentPriority {
  if (priority === 'p0' || priority === 'p1') return 'high';
  if (priority === 'p2') return 'medium';
  return 'low';
}

function strongerPriority(
  left: ProjScanAssessmentPriority | undefined,
  right: ProjScanAssessmentPriority,
): ProjScanAssessmentPriority {
  if (!left) return right;
  const rank: Record<ProjScanAssessmentPriority, number> = { high: 0, medium: 1, low: 2 };
  return rank[right] < rank[left] ? right : left;
}

function riskSeverity(
  verdict: ProjScanAssessmentVerdict,
  priority: AssessProofCard['priority'],
): ProjScanAssessmentRiskSeverity {
  if (verdict === 'block' || priority === 'p0') return 'blocking';
  if (verdict === 'caution' || priority === 'p1') return 'warning';
  return 'info';
}

function validateTaskId(taskId: string): void {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error(
      'Invalid task ID. Task ID must be 1-128 characters, start and end with a letter or number, and contain only letters, numbers, hyphen, or underscore.',
    );
  }
}

function normalizeIntent(intent: string): string {
  const trimmed = intent.trim();
  if (!trimmed) throw new Error('Baseframe assessment requires a non-empty intent.');
  return trimmed;
}

function resolveAssessmentOutputPath(
  root: string,
  taskId: string,
  outputPath: string | undefined,
): string {
  if (outputPath && hasTraversalSegment(outputPath)) {
    throw new Error('Invalid output path. Path traversal segments are not allowed.');
  }
  const expected = defaultAssessmentPath(root, taskId);
  const resolved = outputPath ? path.resolve(root, outputPath) : expected;
  if (resolved !== expected) {
    throw new Error(
      `Invalid output path. ProjScan can only write ${relativeRepositoryPath(root, expected)} for task ${taskId}.`,
    );
  }
  return resolved;
}

function defaultAssessmentPath(root: string, taskId: string): string {
  return path.join(root, BASEFRAME_DIR, EVIDENCE_DIR, taskId, ASSESSMENT_FILE);
}

function hasTraversalSegment(value: string): boolean {
  return value.split(/[\\/]+/).includes('..');
}

async function prepareAssessmentWrite(
  root: string,
  taskId: string,
  outputPath: string,
): Promise<void> {
  await ensureSafeDirectoryPath(root, [BASEFRAME_DIR, EVIDENCE_DIR, taskId]);
  if (path.dirname(outputPath) !== path.join(root, BASEFRAME_DIR, EVIDENCE_DIR, taskId)) {
    throw new Error('Invalid output path. Output parent does not match the task evidence directory.');
  }
}

async function ensureSafeDirectoryPath(root: string, segments: string[]): Promise<void> {
  const rootReal = await fs.realpath(root);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    await ensureDirectoryNoSymlink(current);
  }
  const currentReal = await fs.realpath(current);
  if (!isPathInside(currentReal, rootReal)) {
    throw new Error(`Refusing to write through symlinked Baseframe path: ${current}`);
  }
}

async function ensureDirectoryNoSymlink(dirPath: string): Promise<void> {
  let stat = await lstatOptional(dirPath);
  if (!stat) {
    try {
      await fs.mkdir(dirPath);
    } catch (err) {
      if (!isNodeErrorCode(err, 'EEXIST')) throw err;
    }
    stat = await lstatOptional(dirPath);
  }
  if (!stat) throw new Error(`Could not create output directory: ${dirPath}`);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to write through symlinked Baseframe directory: ${dirPath}`);
  }
  if (!stat.isDirectory()) throw new Error(`Output path component is not a directory: ${dirPath}`);
}

async function assertWritableAssessmentOutput(outputPath: string, taskId: string): Promise<void> {
  const stat = await lstatOptional(outputPath);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to overwrite symlinked output path: ${outputPath}`);
  }
  if (!stat.isFile()) throw new Error(`Existing output path is not a file: ${outputPath}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
  } catch {
    throw new Error(`Refusing to overwrite existing output that is not a ProjScan assessment: ${outputPath}`);
  }
  if (!isMatchingAssessment(parsed, taskId)) {
    throw new Error(`Refusing to overwrite existing output that is not this ProjScan assessment: ${outputPath}`);
  }
}

function isMatchingAssessment(value: unknown, taskId: string): boolean {
  return (
    isRecord(value) &&
    value.schemaVersion === '1.0' &&
    value.kind === 'projscan-assessment' &&
    value.taskId === taskId
  );
}

async function updateWorkflowManifest(input: {
  root: string;
  taskId: string;
  intent: string;
  assessmentPath: string;
  version: string;
  updatedAt: string;
}): Promise<void> {
  const manifestPath = path.join(input.root, BASEFRAME_DIR, 'agent-workflow.json');
  const stat = await lstatOptional(manifestPath);
  if (stat?.isSymbolicLink()) {
    throw new Error(`Refusing to overwrite symlinked workflow manifest: ${manifestPath}`);
  }
  if (stat && !stat.isFile()) {
    throw new Error(`Existing workflow manifest is not a file: ${manifestPath}`);
  }

  const existing = stat ? await readManifest(manifestPath) : {};
  if (typeof existing.taskId === 'string' && existing.taskId !== input.taskId) {
    throw new Error(
      `Workflow manifest already belongs to task ${existing.taskId}; refusing to mix task ${input.taskId}.`,
    );
  }

  const existingTools = isRecord(existing.tools) ? existing.tools : {};
  const manifest: BaseframeAgentWorkflowV1 = {
    ...existing,
    schemaVersion: '1.0',
    taskId: input.taskId,
    intent: input.intent,
    createdAt: typeof existing.createdAt === 'string' ? existing.createdAt : input.updatedAt,
    updatedAt: input.updatedAt,
    tools: {
      ...existingTools,
      projscan: {
        status: 'completed',
        assessmentPath: input.assessmentPath,
        version: input.version,
      },
    },
  };

  await atomicWriteJson(manifestPath, manifest);
}

async function readManifest(manifestPath: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    if (!isRecord(parsed)) throw new Error('workflow manifest must be a JSON object');
    return parsed;
  } catch (err) {
    throw new Error(
      `Could not read workflow manifest ${manifestPath}: ${
        err instanceof Error ? err.message : 'invalid JSON'
      }`,
      { cause: err },
    );
  }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readRepositoryMetadata(root: string): Promise<RepositoryMetadata> {
  const [branch, commit] = await Promise.all([
    gitOutput(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitOutput(root, ['rev-parse', 'HEAD']),
  ]);
  return {
    root,
    ...(branch && branch !== 'HEAD' ? { branch } : {}),
    ...(commit ? { commit } : {}),
  };
}

async function gitOutput(root: string, args: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: root, maxBuffer: 1024 * 1024 });
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

async function readProducerVersion(): Promise<string> {
  if (cachedProducerVersion) return cachedProducerVersion;
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const packagePath = path.resolve(moduleDir, '../../package.json');
    const parsed = JSON.parse(await fs.readFile(packagePath, 'utf-8')) as { version?: unknown };
    cachedProducerVersion = typeof parsed.version === 'string' ? parsed.version : 'unknown';
  } catch {
    cachedProducerVersion = 'unknown';
  }
  return cachedProducerVersion;
}

function relativeRepositoryPath(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function lstatOptional(filePath: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | undefined> {
  try {
    return await fs.lstat(filePath);
  } catch (err) {
    if (isNodeErrorCode(err, 'ENOENT')) return undefined;
    throw err;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
