import { TELEMETRY_SCHEMA_VERSION } from './telemetryConfig.js';
import type { TelemetryEvent } from './telemetryEvents.js';

const REQUEST_TIMEOUT_MS = 750;

export type TelemetrySender = (
  batch: TelemetryEvent[],
  endpoint: string,
) => Promise<{ ok: boolean; status: number }>;

export async function defaultTelemetrySender(
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
