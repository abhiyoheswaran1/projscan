import crypto from 'node:crypto';

import {
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
  writeTelemetryConfig,
  type StoredTelemetryConfig,
  type TelemetryStatus,
} from './telemetryConfig.js';
import {
  type CommandTelemetryInput,
  type CountBucket,
  type DurationBucket,
  type MinutesSavedBucket,
  type TelemetryCommandCategory,
  type TelemetryEvent,
  type TelemetryEventStatus,
  type TelemetryFeedbackInput,
  type TelemetryFeedbackSummary,
} from './telemetryEvents.js';
import {
  recordCommandTelemetry as recordTelemetryCommand,
  recordFeedbackTelemetry as recordTelemetryFeedback,
  type RecordTelemetryResult,
  type TelemetryOptions,
  type TelemetryRecordingRuntime,
} from './telemetryRecording.js';
import { defaultTelemetrySender, type TelemetrySender } from './telemetrySender.js';

export {
  DEFAULT_TELEMETRY_ENDPOINT,
  TELEMETRY_COLLECTED,
  TELEMETRY_ENDPOINT_ENV,
  TELEMETRY_HOME_ENV,
  TELEMETRY_NEVER_COLLECTED,
};
export { buildFeedbackTelemetry } from './telemetryEvents.js';
export type {
  CommandTelemetryInput,
  CountBucket,
  DurationBucket,
  MinutesSavedBucket,
  TelemetryCommandCategory,
  TelemetryEvent,
  TelemetryEventStatus,
  TelemetryFeedbackInput,
  TelemetryFeedbackSummary,
};
export type { TelemetryStatus };

export const TELEMETRY_DISABLED_ENV = 'PROJSCAN_TELEMETRY_DISABLED';
export const TELEMETRY_NO_NETWORK_ENV = 'PROJSCAN_TELEMETRY_NO_NETWORK';
const OFFLINE_ENV = 'PROJSCAN_OFFLINE';

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

export type { TelemetrySender };
export type { RecordTelemetryResult, TelemetryOptions };

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

export async function recordCommandTelemetry(
  input: CommandTelemetryInput,
  options: TelemetryOptions = {},
): Promise<RecordTelemetryResult> {
  return recordTelemetryCommand(input, options, telemetryRecordingRuntime());
}

export async function recordFeedbackTelemetry(
  input: TelemetryFeedbackInput,
  options: TelemetryOptions & { rootPath?: string; version?: string } = {},
): Promise<RecordTelemetryResult> {
  return recordTelemetryFeedback(input, options, telemetryRecordingRuntime());
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
  const sender = options.sender ?? defaultTelemetrySender;
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

function telemetryRecordingRuntime(): TelemetryRecordingRuntime {
  return {
    flushTelemetry,
    isOfflineMode,
    isRuntimeTelemetryDisabled,
    isTelemetryNetworkDisabled,
    offlineReason: OFFLINE_ENV,
    disabledReason: TELEMETRY_DISABLED_ENV,
  };
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
