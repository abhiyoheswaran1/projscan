import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  appendTelemetryQueue,
  buildTelemetryStatus,
  clearTelemetryQueue,
  countTelemetryQueue,
  DEFAULT_TELEMETRY_ENDPOINT,
  getDefaultEndpoint,
  readTelemetryConfig,
  readTelemetryQueue,
  resolveTelemetryPaths,
  TELEMETRY_COLLECTED,
  TELEMETRY_ENDPOINT_ENV,
  TELEMETRY_HOME_ENV,
  TELEMETRY_NEVER_COLLECTED,
  TELEMETRY_SCHEMA_VERSION,
  toIso,
  updateTelemetryUsage,
  writeTelemetryConfig,
  type StoredTelemetryConfig,
  type TelemetryStatus,
} from './telemetryConfig.js';

export {
  DEFAULT_TELEMETRY_ENDPOINT,
  TELEMETRY_COLLECTED,
  TELEMETRY_ENDPOINT_ENV,
  TELEMETRY_HOME_ENV,
  TELEMETRY_NEVER_COLLECTED,
};
export type { TelemetryStatus };

export const TELEMETRY_DISABLED_ENV = 'PROJSCAN_TELEMETRY_DISABLED';
export const TELEMETRY_NO_NETWORK_ENV = 'PROJSCAN_TELEMETRY_NO_NETWORK';
const OFFLINE_ENV = 'PROJSCAN_OFFLINE';

const REQUEST_TIMEOUT_MS = 750;

export type TelemetryCommandCategory =
  | 'doctor'
  | 'review'
  | 'preflight'
  | 'dogfood'
  | 'feedback'
  | 'trial'
  | 'init'
  | 'mcp'
  | 'evidence'
  | 'start'
  | 'other';

const TELEMETRY_COMMAND_CATEGORY_BY_COMMAND: Readonly<
  Partial<Record<string, TelemetryCommandCategory>>
> = {
  doctor: 'doctor',
  review: 'review',
  preflight: 'preflight',
  dogfood: 'dogfood',
  feedback: 'feedback',
  trial: 'trial',
  init: 'init',
  mcp: 'mcp',
  'evidence-pack': 'evidence',
  start: 'start',
  'first-run': 'start',
  recipes: 'start',
};

export type TelemetryEventStatus = 'success' | 'failure';
export type DurationBucket = '<1s' | '1-5s' | '5-30s' | '30s-2m' | '2m+';
export type CountBucket = '0' | '1' | '2-5' | '6-20' | '21-100' | '100+';
export type MinutesSavedBucket = '0' | '1-5' | '6-10' | '10-20' | '20+';

export interface TelemetryPolicy {
  schemaVersion: 1;
  default: 'off';
  prompt: string;
  endpoint: string;
  collected: string[];
  neverCollected: string[];
  controls: string[];
  notes: string[];
}

export interface TelemetryFeedbackInput {
  repo?: unknown;
  pr?: unknown;
  reviewer?: unknown;
  useful?: boolean;
  minutesSaved?: number;
  preventedBadEdit?: boolean;
  falsePositiveRules?: unknown[];
  falsePositiveReported?: boolean;
}

export interface TelemetryFeedbackSummary {
  useful?: boolean;
  minutesSavedBucket?: MinutesSavedBucket;
  preventedBadEdit?: boolean;
  falsePositiveReported?: boolean;
}

export interface CommandTelemetryInput {
  commandName: string;
  status: TelemetryEventStatus;
  durationMs: number;
  rootPath?: string;
  version?: string;
  feedback?: TelemetryFeedbackSummary;
}

export interface TelemetryEvent {
  schemaVersion: 1;
  eventId: string;
  eventType: 'command_run' | 'feedback_outcome';
  anonymousId: string;
  occurredAt: string;
  commandCategory: TelemetryCommandCategory;
  commandName: string;
  status: TelemetryEventStatus;
  durationBucket: DurationBucket;
  version: string;
  nodeMajor: number;
  platform: NodeJS.Platform;
  ci: boolean;
  setup: {
    githubActionConfigured: boolean;
    mcpConfigured: boolean;
    teamInitConfigured: boolean;
  };
  repeatUse: {
    runCountBucket: CountBucket;
    activeDaysBucket: CountBucket;
  };
  feedback?: TelemetryFeedbackSummary;
}

export type TelemetrySender = (
  batch: TelemetryEvent[],
  endpoint: string,
) => Promise<{ ok: boolean; status: number }>;

export interface TelemetryOptions {
  configDir?: string;
  now?: Date;
  sender?: TelemetrySender;
  flush?: boolean;
}

export interface RecordTelemetryResult {
  status: 'skipped' | 'queued' | 'sent' | 'failed';
  reason?: string;
  queued?: number;
}

export function explainTelemetryPolicy(): TelemetryPolicy {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    default: 'off',
    prompt: getTelemetryOptInPrompt(),
    endpoint: getDefaultEndpoint(),
    collected: [...TELEMETRY_COLLECTED],
    neverCollected: [...TELEMETRY_NEVER_COLLECTED],
    controls: [
      'projscan telemetry status',
      'projscan telemetry enable',
      'projscan telemetry disable',
      'projscan telemetry explain',
    ],
    notes: [
      'Telemetry is never enabled silently.',
      'Events are anonymous product-health signals, not scan data.',
      'Disabling telemetry clears the local queue and removes the anonymous id.',
      'Reviewer outcome feedback remains explicit through projscan feedback add; telemetry only buckets those answers when enabled.',
    ],
  };
}

export function getTelemetryOptInPrompt(): string {
  return 'Share anonymous usage metrics to improve projscan? No code, paths, package names, branch names, or secrets are collected. [y/N] ';
}

export async function getTelemetryStatus(options: TelemetryOptions = {}): Promise<TelemetryStatus> {
  const paths = resolveTelemetryPaths(options);
  const loaded = await readTelemetryConfig(paths.configPath, options.now);
  const queueLength = await countTelemetryQueue(paths.queuePath);
  const enabled = isRuntimeTelemetryDisabled() ? false : loaded.config.enabled === true;
  return buildTelemetryStatus(paths, loaded.config, queueLength, enabled);
}

export async function enableTelemetry(
  options: TelemetryOptions & { endpoint?: string } = {},
): Promise<TelemetryStatus> {
  const paths = resolveTelemetryPaths(options);
  const loaded = await readTelemetryConfig(paths.configPath, options.now);
  const now = toIso(options.now);
  const config: StoredTelemetryConfig = {
    ...loaded.config,
    enabled: true,
    anonymousId: loaded.config.anonymousId ?? generateAnonymousId(),
    endpoint: options.endpoint ?? loaded.config.endpoint ?? getDefaultEndpoint(),
    updatedAt: now,
  };
  await writeTelemetryConfig(paths.configPath, config);
  return buildTelemetryStatus(
    paths,
    config,
    await countTelemetryQueue(paths.queuePath),
    !isRuntimeTelemetryDisabled(),
  );
}

export async function disableTelemetry(options: TelemetryOptions = {}): Promise<TelemetryStatus> {
  const paths = resolveTelemetryPaths(options);
  const loaded = await readTelemetryConfig(paths.configPath, options.now);
  const now = toIso(options.now);
  const config: StoredTelemetryConfig = {
    ...loaded.config,
    enabled: false,
    anonymousId: undefined,
    updatedAt: now,
  };
  await writeTelemetryConfig(paths.configPath, config);
  await clearTelemetryQueue(paths.queuePath);
  return buildTelemetryStatus(paths, config, 0, false);
}

export function buildFeedbackTelemetry(input: TelemetryFeedbackInput): TelemetryFeedbackSummary {
  const result: TelemetryFeedbackSummary = {};
  if (typeof input.useful === 'boolean') result.useful = input.useful;
  if (typeof input.minutesSaved === 'number' && Number.isFinite(input.minutesSaved)) {
    result.minutesSavedBucket = bucketMinutes(input.minutesSaved);
  }
  if (typeof input.preventedBadEdit === 'boolean') result.preventedBadEdit = input.preventedBadEdit;
  const ruleCount = Array.isArray(input.falsePositiveRules) ? input.falsePositiveRules.length : 0;
  if (typeof input.falsePositiveReported === 'boolean' || ruleCount > 0) {
    result.falsePositiveReported = input.falsePositiveReported === true || ruleCount > 0;
  }
  return result;
}

export async function recordCommandTelemetry(
  input: CommandTelemetryInput,
  options: TelemetryOptions = {},
): Promise<RecordTelemetryResult> {
  if (isOfflineMode()) return { status: 'skipped', reason: OFFLINE_ENV };
  if (isRuntimeTelemetryDisabled()) return { status: 'skipped', reason: TELEMETRY_DISABLED_ENV };
  const paths = resolveTelemetryPaths(options);
  const loaded = await readTelemetryConfig(paths.configPath, options.now);
  if (!loaded.config.enabled || !loaded.config.anonymousId)
    return { status: 'skipped', reason: 'disabled' };

  const config = updateTelemetryUsage(loaded.config, options.now);
  await writeTelemetryConfig(paths.configPath, config);

  const event = await buildCommandEvent(input, config, options.now);
  await appendTelemetryQueue(paths.queuePath, event);

  if (options.flush === false || isTelemetryNetworkDisabled()) {
    return { status: 'queued', queued: await countTelemetryQueue(paths.queuePath) };
  }

  const flushed = await flushTelemetry({ ...options, configDir: paths.configDir });
  if (flushed.status === 'sent') return flushed;
  return {
    status: 'queued',
    reason: flushed.reason,
    queued: await countTelemetryQueue(paths.queuePath),
  };
}

export async function recordFeedbackTelemetry(
  input: TelemetryFeedbackInput,
  options: TelemetryOptions & { rootPath?: string; version?: string } = {},
): Promise<RecordTelemetryResult> {
  return recordCommandTelemetry(
    {
      commandName: 'feedback add',
      status: 'success',
      durationMs: 0,
      rootPath: options.rootPath,
      version: options.version,
      feedback: buildFeedbackTelemetry(input),
    },
    options,
  );
}

export async function flushTelemetry(
  options: TelemetryOptions = {},
): Promise<RecordTelemetryResult> {
  const blocked = flushBlockedResult();
  if (blocked) return blocked;
  const paths = resolveTelemetryPaths(options);
  const loaded = await readTelemetryConfig(paths.configPath, options.now);
  if (!loaded.config.enabled || !loaded.config.anonymousId)
    return { status: 'skipped', reason: 'disabled' };
  const events = await readTelemetryQueue<TelemetryEvent>(paths.queuePath);
  if (events.length === 0) return { status: 'skipped', reason: 'empty' };
  const sender = options.sender ?? defaultSender;
  return sendQueuedTelemetry(events, loaded.config.endpoint, sender, paths.queuePath);
}

function flushBlockedResult(): RecordTelemetryResult | null {
  if (isOfflineMode()) return { status: 'skipped', reason: OFFLINE_ENV };
  if (isRuntimeTelemetryDisabled()) return { status: 'skipped', reason: TELEMETRY_DISABLED_ENV };
  if (isTelemetryNetworkDisabled()) return { status: 'queued', reason: TELEMETRY_NO_NETWORK_ENV };
  return null;
}

async function sendQueuedTelemetry(
  events: TelemetryEvent[],
  endpoint: string,
  sender: TelemetrySender,
  queuePath: string,
): Promise<RecordTelemetryResult> {
  try {
    const result = await sender(events, endpoint);
    if (!result.ok)
      return { status: 'failed', reason: 'http_' + result.status, queued: events.length };
    await clearTelemetryQueue(queuePath);
    return { status: 'sent', queued: 0 };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      queued: events.length,
    };
  }
}

async function buildCommandEvent(
  input: CommandTelemetryInput,
  config: StoredTelemetryConfig,
  nowValue: Date | undefined,
): Promise<TelemetryEvent> {
  const now = nowValue ?? new Date();
  const rootPath = input.rootPath ?? process.cwd();
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    eventId: 'evt_' + crypto.randomUUID(),
    eventType: input.feedback ? 'feedback_outcome' : 'command_run',
    anonymousId: config.anonymousId ?? generateAnonymousId(),
    occurredAt: toIso(now),
    commandCategory: categorizeCommand(input.commandName),
    commandName: sanitizeCommandName(input.commandName),
    status: input.status,
    durationBucket: bucketDuration(input.durationMs),
    version: sanitizeVersion(input.version),
    nodeMajor: Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10) || 0,
    platform: process.platform,
    ci: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
    setup: await detectSetup(rootPath),
    repeatUse: {
      runCountBucket: bucketCount(config.usage.runCount),
      activeDaysBucket: bucketCount(config.usage.activeDays.length),
    },
    ...(input.feedback ? { feedback: input.feedback } : {}),
  };
}

function categorizeCommand(commandName: string): TelemetryCommandCategory {
  const name = sanitizeCommandName(commandName);
  const first = name.split(' ')[0] ?? 'other';
  return TELEMETRY_COMMAND_CATEGORY_BY_COMMAND[first] ?? 'other';
}

function sanitizeCommandName(commandName: string): string {
  return (
    commandName
      .toLowerCase()
      .replace(/[^a-z0-9:_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(' ') || 'unknown'
  );
}

function sanitizeVersion(value: string | undefined): string {
  if (!value) return 'unknown';
  return /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value) ? value : 'unknown';
}

function bucketDuration(durationMs: number): DurationBucket {
  if (!Number.isFinite(durationMs) || durationMs < 1000) return '<1s';
  if (durationMs < 5000) return '1-5s';
  if (durationMs < 30000) return '5-30s';
  if (durationMs < 120000) return '30s-2m';
  return '2m+';
}

function bucketMinutes(value: number): MinutesSavedBucket {
  if (value <= 0) return '0';
  if (value <= 5) return '1-5';
  if (value <= 10) return '6-10';
  if (value <= 20) return '10-20';
  return '20+';
}

function bucketCount(value: number): CountBucket {
  if (value <= 0) return '0';
  if (value === 1) return '1';
  if (value <= 5) return '2-5';
  if (value <= 20) return '6-20';
  if (value <= 100) return '21-100';
  return '100+';
}

async function detectSetup(rootPath: string): Promise<TelemetryEvent['setup']> {
  const githubActionConfigured = await exists(
    path.join(rootPath, '.github', 'workflows', 'projscan.yml'),
  );
  const teamInitConfigured =
    (await exists(path.join(rootPath, '.projscan-baseline.json'))) ||
    (await exists(path.join(rootPath, '.github', 'CODEOWNERS')));
  const mcpConfigured = await anyExists([
    path.join(rootPath, '.codex', 'config.toml'),
    path.join(rootPath, '.cursor', 'mcp.json'),
    path.join(rootPath, '.continue', 'config.json'),
  ]);
  return { githubActionConfigured, mcpConfigured, teamInitConfigured };
}

async function anyExists(paths: string[]): Promise<boolean> {
  for (const candidate of paths) {
    if (await exists(candidate)) return true;
  }
  return false;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function defaultSender(
  batch: TelemetryEvent[],
  endpoint: string,
): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'projscan-telemetry',
      },
      body: JSON.stringify({ schemaVersion: TELEMETRY_SCHEMA_VERSION, events: batch }),
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function generateAnonymousId(): string {
  return 'psn_' + crypto.randomUUID();
}

function isOfflineMode(): boolean {
  const value = process.env[OFFLINE_ENV];
  return value === '1' || value === 'true' || value === 'yes';
}

function isRuntimeTelemetryDisabled(): boolean {
  const value = process.env[TELEMETRY_DISABLED_ENV];
  return value === '1' || value === 'true';
}

function isTelemetryNetworkDisabled(): boolean {
  return process.env[TELEMETRY_NO_NETWORK_ENV] === '1';
}
