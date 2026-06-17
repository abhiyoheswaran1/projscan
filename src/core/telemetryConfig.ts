import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_TELEMETRY_ENDPOINT = 'https://www.baseframelabs.com/api/projscan/telemetry';
export const TELEMETRY_HOME_ENV = 'PROJSCAN_TELEMETRY_HOME';
export const TELEMETRY_ENDPOINT_ENV = 'PROJSCAN_TELEMETRY_ENDPOINT';
export const TELEMETRY_SCHEMA_VERSION = 1;

const CONFIG_FILE = 'telemetry.json';
const QUEUE_FILE = 'telemetry-queue.jsonl';

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

export interface StoredTelemetryConfig {
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

export interface TelemetryPaths {
  configDir: string;
  configPath: string;
  queuePath: string;
}

export interface TelemetryPathOptions {
  configDir?: string;
}

export function buildTelemetryStatus(
  paths: TelemetryPaths,
  config: StoredTelemetryConfig,
  queueLength: number,
  enabledOverride: boolean,
): TelemetryStatus {
  const enabled = enabledOverride && config.enabled === true;
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    enabled,
    mode: enabled ? 'enabled' : 'disabled',
    anonymousId: enabled ? (config.anonymousId ?? null) : null,
    endpoint: config.endpoint,
    configPath: paths.configPath,
    queuePath: paths.queuePath,
    queueLength: enabled ? queueLength : 0,
    collected: [...TELEMETRY_COLLECTED],
    neverCollected: [...TELEMETRY_NEVER_COLLECTED],
    controls: [
      'projscan telemetry status',
      'projscan telemetry enable',
      'projscan telemetry disable',
      'projscan telemetry explain',
    ],
    nextCommands: enabled
      ? ['projscan telemetry disable', 'projscan telemetry explain']
      : ['projscan telemetry explain', 'projscan telemetry enable'],
  };
}

export function resolveTelemetryPaths(options: TelemetryPathOptions): TelemetryPaths {
  const configDir = options.configDir ?? defaultTelemetryConfigDir();
  return {
    configDir,
    configPath: path.join(configDir, CONFIG_FILE),
    queuePath: path.join(configDir, QUEUE_FILE),
  };
}

export function getDefaultEndpoint(): string {
  return process.env[TELEMETRY_ENDPOINT_ENV] || DEFAULT_TELEMETRY_ENDPOINT;
}

export async function readTelemetryConfig(
  configPath: string,
  nowValue: Date | undefined,
): Promise<{ exists: boolean; config: StoredTelemetryConfig }> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredTelemetryConfig>;
    return { exists: true, config: normalizeTelemetryConfig(parsed, nowValue) };
  } catch {
    return { exists: false, config: defaultTelemetryConfig(nowValue) };
  }
}

export function normalizeTelemetryConfig(
  value: Partial<StoredTelemetryConfig>,
  nowValue: Date | undefined,
): StoredTelemetryConfig {
  const fallback = defaultTelemetryConfig(nowValue);
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    enabled: value.enabled === true,
    anonymousId: typeof value.anonymousId === 'string' ? value.anonymousId : undefined,
    endpoint: typeof value.endpoint === 'string' ? value.endpoint : getDefaultEndpoint(),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    usage: {
      firstSeenDay:
        typeof value.usage?.firstSeenDay === 'string' ? value.usage.firstSeenDay : undefined,
      lastSeenDay:
        typeof value.usage?.lastSeenDay === 'string' ? value.usage.lastSeenDay : undefined,
      runCount: Number.isFinite(value.usage?.runCount) ? Number(value.usage?.runCount) : 0,
      activeDays: Array.isArray(value.usage?.activeDays)
        ? value.usage.activeDays.filter((item): item is string => typeof item === 'string')
        : [],
    },
  };
}

export function defaultTelemetryConfig(nowValue: Date | undefined): StoredTelemetryConfig {
  const now = toIso(nowValue);
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    enabled: false,
    endpoint: getDefaultEndpoint(),
    createdAt: now,
    updatedAt: now,
    usage: { runCount: 0, activeDays: [] },
  };
}

export function updateTelemetryUsage(
  config: StoredTelemetryConfig,
  nowValue: Date | undefined,
): StoredTelemetryConfig {
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

export async function writeTelemetryConfig(
  configPath: string,
  config: StoredTelemetryConfig,
): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export async function appendTelemetryQueue<T>(queuePath: string, event: T): Promise<void> {
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  await fs.appendFile(queuePath, JSON.stringify(event) + '\n', 'utf-8');
}

export async function readTelemetryQueue<T>(queuePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(queuePath, 'utf-8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

export async function countTelemetryQueue(queuePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(queuePath, 'utf-8');
    return raw.split('\n').filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

export async function clearTelemetryQueue(queuePath: string): Promise<void> {
  await fs.rm(queuePath, { force: true });
}

export function toIso(value: Date | undefined): string {
  return (value ?? new Date()).toISOString();
}

function defaultTelemetryConfigDir(): string {
  if (process.env[TELEMETRY_HOME_ENV])
    return path.resolve(process.env[TELEMETRY_HOME_ENV] as string);
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'projscan');
  return path.join(os.homedir(), '.config', 'projscan');
}

function toDay(value: Date | undefined): string {
  return toIso(value).slice(0, 10);
}
