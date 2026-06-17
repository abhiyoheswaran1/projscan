import {
  appendTelemetryQueue,
  countTelemetryQueue,
  readTelemetryConfig,
  resolveTelemetryPaths,
  updateTelemetryUsage,
  writeTelemetryConfig,
} from './telemetryConfig.js';
import {
  buildFeedbackTelemetry,
  buildTelemetryCommandEvent,
  type CommandTelemetryInput,
  type TelemetryFeedbackInput,
} from './telemetryEvents.js';
import type { TelemetrySender } from './telemetrySender.js';

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

export interface TelemetryRecordingRuntime {
  flushTelemetry: (options?: TelemetryOptions) => Promise<RecordTelemetryResult>;
  isOfflineMode: () => boolean;
  isRuntimeTelemetryDisabled: () => boolean;
  isTelemetryNetworkDisabled: () => boolean;
  offlineReason: string;
  disabledReason: string;
}

export async function recordCommandTelemetry(
  input: CommandTelemetryInput,
  options: TelemetryOptions,
  runtime: TelemetryRecordingRuntime,
): Promise<RecordTelemetryResult> {
  if (runtime.isOfflineMode()) return { status: 'skipped', reason: runtime.offlineReason };
  if (runtime.isRuntimeTelemetryDisabled())
    return { status: 'skipped', reason: runtime.disabledReason };
  const paths = resolveTelemetryPaths(options);
  const loaded = await readTelemetryConfig(paths.configPath, options.now);
  if (!loaded.config.enabled || !loaded.config.anonymousId)
    return { status: 'skipped', reason: 'disabled' };

  const config = updateTelemetryUsage(loaded.config, options.now);
  await writeTelemetryConfig(paths.configPath, config);

  const event = await buildTelemetryCommandEvent(input, config, options.now);
  await appendTelemetryQueue(paths.queuePath, event);

  if (options.flush === false || runtime.isTelemetryNetworkDisabled()) {
    return { status: 'queued', queued: await countTelemetryQueue(paths.queuePath) };
  }

  const flushed = await runtime.flushTelemetry({ ...options, configDir: paths.configDir });
  if (flushed.status === 'sent') return flushed;
  return {
    status: 'queued',
    reason: flushed.reason,
    queued: await countTelemetryQueue(paths.queuePath),
  };
}

export async function recordFeedbackTelemetry(
  input: TelemetryFeedbackInput,
  options: TelemetryOptions & { rootPath?: string; version?: string },
  runtime: TelemetryRecordingRuntime,
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
    runtime,
  );
}
