import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_TELEMETRY_ENDPOINT = 'https://www.baseframelabs.com/api/projscan/telemetry';
export const TELEMETRY_HOME_ENV = 'PROJSCAN_TELEMETRY_HOME';
export const TELEMETRY_ENDPOINT_ENV = 'PROJSCAN_TELEMETRY_ENDPOINT';
export const TELEMETRY_DISABLED_ENV = 'PROJSCAN_TELEMETRY_DISABLED';
export const TELEMETRY_NO_NETWORK_ENV = 'PROJSCAN_TELEMETRY_NO_NETWORK';
const OFFLINE_ENV = 'PROJSCAN_OFFLINE';

const CONFIG_FILE = 'telemetry.json';
const QUEUE_FILE = 'telemetry-queue.jsonl';
const SCHEMA_VERSION = 1;
const REQUEST_TIMEOUT_MS = 750;

export const TELEMETRY_COLLECTED = [
  'command_category',
  'command_name',
  'success_or_failure',
  'duration_bucket',
  'projscan_version',
  'node_major',
  'platform',
  'ci_boolean',
  'setup_booleans',
  'repeat_use_buckets',
  'optional_feedback_buckets',
] as const;

export const TELEMETRY_NEVER_COLLECTED = [
  'source_code',
  'file_paths',
  'repo_names',
  'branch_names',
  'package_names',
  'usernames',
  'emails',
  'raw_findings',
  'secrets',
  'environment_variables',
] as const;

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

interface StoredTelemetryConfig {
  schemaVersion: 1;
  enabled: boolean;
  anonymousId?: string;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
  usage: {
    firstSeenDay?: string;
    lastSeenDay?: string;
    runCount: number;
    activeDays: string[];
  };
}

export interface TelemetryStatus {
  schemaVersion: 1;
  enabled: boolean;
  mode: 'enabled' | 'disabled';
  anonymousId: string | null;
  endpoint: string;
  configPath: string;
  queuePath: string;
  queueLength: number;
  collected: string[];
  neverCollected: string[];
  controls: string[];
  nextCommands: string[];
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

export type TelemetrySender = (batch: TelemetryEvent[], endpoint: string) => Promise<{ ok: boolean; status: number }>;

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
    schemaVersion: 1,
    default: 'off',
    prompt: getTelemetryOptInPrompt(),
    endpoint: getDefaultEndpoint(),
    collected: [...TELEMETRY_COLLECTED],
    neverCollected: [...TELEMETRY_NEVER_COLLECTED],
    controls: ['projscan telemetry status', 'projscan telemetry enable', 'projscan telemetry disable', 'projscan telemetry explain'],
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
  const loaded = await readConfig(paths.configPath, options.now);
  const queueLength = await countQueue(paths.queuePath);
  const enabled = isRuntimeTelemetryDisabled() ? false : loaded.config.enabled === true;
  return buildStatus(paths, loaded.config, queueLength, enabled);
}

export async function enableTelemetry(options: TelemetryOptions & { endpoint?: string } = {}): Promise<TelemetryStatus> {
  const paths = resolveTelemetryPaths(options);
  const loaded = await readConfig(paths.configPath, options.now);
  const now = toIso(options.now);
  const config: StoredTelemetryConfig = {
    ...loaded.config,
    enabled: true,
    anonymousId: loaded.config.anonymousId ?? generateAnonymousId(),
    endpoint: options.endpoint ?? loaded.config.endpoint ?? getDefaultEndpoint(),
    updatedAt: now,
  };
  await writeConfig(paths.configPath, config);
  return buildStatus(paths, config, await countQueue(paths.queuePath), !isRuntimeTelemetryDisabled());
}

export async function disableTelemetry(options: TelemetryOptions = {}): Promise<TelemetryStatus> {
  const paths = resolveTelemetryPaths(options);
  const loaded = await readConfig(paths.configPath, options.now);
  const now = toIso(options.now);
  const config: StoredTelemetryConfig = {
    ...loaded.config,
    enabled: false,
    anonymousId: undefined,
    updatedAt: now,
  };
  await writeConfig(paths.configPath, config);
  await fs.rm(paths.queuePath, { force: true });
  return buildStatus(paths, config, 0, false);
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
  const loaded = await readConfig(paths.configPath, options.now);
  if (!loaded.config.enabled || !loaded.config.anonymousId) return { status: 'skipped', reason: 'disabled' };

  const config = updateUsage(loaded.config, options.now);
  await writeConfig(paths.configPath, config);

  const event = await buildCommandEvent(input, config, options.now);
  await appendQueue(paths.queuePath, event);

  if (options.flush === false || process.env[TELEMETRY_NO_NETWORK_ENV] === '1') {
    return { status: 'queued', queued: await countQueue(paths.queuePath) };
  }

  const flushed = await flushTelemetry({ ...options, configDir: paths.configDir });
  if (flushed.status === 'sent') return flushed;
  return { status: 'queued', reason: flushed.reason, queued: await countQueue(paths.queuePath) };
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

export async function flushTelemetry(options: TelemetryOptions = {}): Promise<RecordTelemetryResult> {
  if (isOfflineMode()) return { status: 'skipped', reason: OFFLINE_ENV };
  if (isRuntimeTelemetryDisabled()) return { status: 'skipped', reason: TELEMETRY_DISABLED_ENV };
  if (process.env[TELEMETRY_NO_NETWORK_ENV] === '1') return { status: 'queued', reason: TELEMETRY_NO_NETWORK_ENV };
  const paths = resolveTelemetryPaths(options);
  const loaded = await readConfig(paths.configPath, options.now);
  if (!loaded.config.enabled || !loaded.config.anonymousId) return { status: 'skipped', reason: 'disabled' };
  const events = await readQueue(paths.queuePath);
  if (events.length === 0) return { status: 'skipped', reason: 'empty' };
  const sender = options.sender ?? defaultSender;
  try {
    const result = await sender(events, loaded.config.endpoint);
    if (!result.ok) return { status: 'failed', reason: 'http_' + result.status, queued: events.length };
    await fs.rm(paths.queuePath, { force: true });
    return { status: 'sent', queued: 0 };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error), queued: events.length };
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
    schemaVersion: SCHEMA_VERSION,
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
  if (first === 'doctor') return 'doctor';
  if (first === 'review') return 'review';
  if (first === 'preflight') return 'preflight';
  if (first === 'dogfood') return 'dogfood';
  if (first === 'feedback') return 'feedback';
  if (first === 'trial') return 'trial';
  if (first === 'init') return 'init';
  if (first === 'mcp') return 'mcp';
  if (first === 'evidence-pack') return 'evidence';
  if (first === 'start' || first === 'first-run' || first === 'recipes') return 'start';
  return 'other';
}

function sanitizeCommandName(commandName: string): string {
  return commandName
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ') || 'unknown';
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
  const githubActionConfigured = await exists(path.join(rootPath, '.github', 'workflows', 'projscan.yml'));
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

function updateUsage(config: StoredTelemetryConfig, nowValue: Date | undefined): StoredTelemetryConfig {
  const day = toDay(nowValue);
  const activeDays = new Set(config.usage.activeDays ?? []);
  activeDays.add(day);
  return {
    ...config,
    updatedAt: toIso(nowValue),
    usage: {
      firstSeenDay: config.usage.firstSeenDay ?? day,
      lastSeenDay: day,
      runCount: (config.usage.runCount ?? 0) + 1,
      activeDays: [...activeDays].sort(),
    },
  };
}

function buildStatus(
  paths: TelemetryPaths,
  config: StoredTelemetryConfig,
  queueLength: number,
  enabledOverride: boolean,
): TelemetryStatus {
  const enabled = enabledOverride && config.enabled === true;
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled,
    mode: enabled ? 'enabled' : 'disabled',
    anonymousId: enabled ? (config.anonymousId ?? null) : null,
    endpoint: config.endpoint,
    configPath: paths.configPath,
    queuePath: paths.queuePath,
    queueLength: enabled ? queueLength : 0,
    collected: [...TELEMETRY_COLLECTED],
    neverCollected: [...TELEMETRY_NEVER_COLLECTED],
    controls: ['projscan telemetry status', 'projscan telemetry enable', 'projscan telemetry disable', 'projscan telemetry explain'],
    nextCommands: enabled
      ? ['projscan telemetry disable', 'projscan telemetry explain']
      : ['projscan telemetry explain', 'projscan telemetry enable'],
  };
}

interface TelemetryPaths {
  configDir: string;
  configPath: string;
  queuePath: string;
}

function resolveTelemetryPaths(options: TelemetryOptions): TelemetryPaths {
  const configDir = options.configDir ?? defaultConfigDir();
  return {
    configDir,
    configPath: path.join(configDir, CONFIG_FILE),
    queuePath: path.join(configDir, QUEUE_FILE),
  };
}

function defaultConfigDir(): string {
  if (process.env[TELEMETRY_HOME_ENV]) return path.resolve(process.env[TELEMETRY_HOME_ENV] as string);
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'projscan');
  return path.join(os.homedir(), '.config', 'projscan');
}

function getDefaultEndpoint(): string {
  return process.env[TELEMETRY_ENDPOINT_ENV] || DEFAULT_TELEMETRY_ENDPOINT;
}

async function readConfig(configPath: string, nowValue: Date | undefined): Promise<{ exists: boolean; config: StoredTelemetryConfig }> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredTelemetryConfig>;
    return { exists: true, config: normalizeConfig(parsed, nowValue) };
  } catch {
    return { exists: false, config: defaultConfig(nowValue) };
  }
}

function normalizeConfig(value: Partial<StoredTelemetryConfig>, nowValue: Date | undefined): StoredTelemetryConfig {
  const fallback = defaultConfig(nowValue);
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: value.enabled === true,
    anonymousId: typeof value.anonymousId === 'string' ? value.anonymousId : undefined,
    endpoint: typeof value.endpoint === 'string' ? value.endpoint : getDefaultEndpoint(),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    usage: {
      firstSeenDay: typeof value.usage?.firstSeenDay === 'string' ? value.usage.firstSeenDay : undefined,
      lastSeenDay: typeof value.usage?.lastSeenDay === 'string' ? value.usage.lastSeenDay : undefined,
      runCount: Number.isFinite(value.usage?.runCount) ? Number(value.usage?.runCount) : 0,
      activeDays: Array.isArray(value.usage?.activeDays)
        ? value.usage.activeDays.filter((item): item is string => typeof item === 'string')
        : [],
    },
  };
}

function defaultConfig(nowValue: Date | undefined): StoredTelemetryConfig {
  const now = toIso(nowValue);
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: false,
    endpoint: getDefaultEndpoint(),
    createdAt: now,
    updatedAt: now,
    usage: { runCount: 0, activeDays: [] },
  };
}

async function writeConfig(configPath: string, config: StoredTelemetryConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

async function appendQueue(queuePath: string, event: TelemetryEvent): Promise<void> {
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  await fs.appendFile(queuePath, JSON.stringify(event) + '\n', 'utf-8');
}

async function readQueue(queuePath: string): Promise<TelemetryEvent[]> {
  try {
    const raw = await fs.readFile(queuePath, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TelemetryEvent);
  } catch {
    return [];
  }
}

async function countQueue(queuePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(queuePath, 'utf-8');
    return raw.split('\n').filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

async function defaultSender(batch: TelemetryEvent[], endpoint: string): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'projscan-telemetry',
      },
      body: JSON.stringify({ schemaVersion: SCHEMA_VERSION, events: batch }),
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

function toIso(value: Date | undefined): string {
  return (value ?? new Date()).toISOString();
}

function toDay(value: Date | undefined): string {
  return toIso(value).slice(0, 10);
}
