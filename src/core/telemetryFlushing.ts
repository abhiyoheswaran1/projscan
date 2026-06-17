import {
  clearTelemetryQueue,
  readTelemetryConfig,
  readTelemetryQueue,
  resolveTelemetryPaths,
} from './telemetryConfig.js';
import type { TelemetryEvent } from './telemetryEvents.js';
import type { RecordTelemetryResult, TelemetryOptions } from './telemetryRecording.js';
import { defaultTelemetrySender, type TelemetrySender } from './telemetrySender.js';

export interface TelemetryFlushRuntime {
  isOfflineMode: () => boolean;
  isRuntimeTelemetryDisabled: () => boolean;
  isTelemetryNetworkDisabled: () => boolean;
  offlineReason: string;
  disabledReason: string;
  noNetworkReason: string;
}

export async function flushTelemetry(
  options: TelemetryOptions,
  runtime: TelemetryFlushRuntime,
): Promise<RecordTelemetryResult> {
  const blocked = flushBlockedResult(runtime);
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

function flushBlockedResult(runtime: TelemetryFlushRuntime): RecordTelemetryResult | null {
  if (runtime.isOfflineMode()) return { status: 'skipped', reason: runtime.offlineReason };
  if (runtime.isRuntimeTelemetryDisabled())
    return { status: 'skipped', reason: runtime.disabledReason };
  if (runtime.isTelemetryNetworkDisabled())
    return { status: 'queued', reason: runtime.noNetworkReason };
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
