import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Opt-in, privacy-preserving telemetry (0.14).
 *
 * What it records: tool name, duration, success/failure, projscan version,
 * iso timestamp. That's it. NO source content, NO file paths, NO arguments,
 * NO repository identifiers, NO machine identifiers.
 *
 * What it does NOT do: send anything off the machine. The MVP sink is a
 * local JSONL file the user controls. A remote sink may follow in a later
 * release once we have a server worth pointing at.
 *
 * Discoverability: off by default. Enable via .projscanrc telemetry block,
 * or PROJSCAN_TELEMETRY=1 env var (env wins). PROJSCAN_TELEMETRY=0 disables
 * even when the config opts in (per-machine kill switch).
 */

export interface TelemetryConfig {
  enabled: boolean;
  /**
   * Where to write events. Default: `~/.projscan/telemetry.jsonl`.
   * Either a path or the literal string "stderr" (test/diagnostic use).
   */
  sink: string;
}

export interface TelemetryEvent {
  ts: string;
  version: string;
  tool: string;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
}

const DEFAULT_SINK_DIR = path.join(os.homedir(), '.projscan');
const DEFAULT_SINK_FILE = path.join(DEFAULT_SINK_DIR, 'telemetry.jsonl');

let cachedConfig: TelemetryConfig | undefined;
let cachedVersion: string | undefined;

/**
 * Resolve effective config. Env var takes precedence; .projscanrc supplies
 * the sink and acts as the default. Non-throwing — bad config silently
 * disables.
 */
export function resolveTelemetryConfig(rcConfig?: {
  enabled?: boolean;
  sink?: string;
}): TelemetryConfig {
  if (cachedConfig) return cachedConfig;
  const envFlag = process.env.PROJSCAN_TELEMETRY;
  let enabled = !!rcConfig?.enabled;
  if (envFlag === '1' || envFlag?.toLowerCase() === 'true') enabled = true;
  if (envFlag === '0' || envFlag?.toLowerCase() === 'false') enabled = false;
  const sink = rcConfig?.sink || DEFAULT_SINK_FILE;
  cachedConfig = { enabled, sink };
  return cachedConfig;
}

/** Test-only: drop the cached config so tests can mutate env between cases. */
export function _resetTelemetryConfigForTests(): void {
  cachedConfig = undefined;
  cachedVersion = undefined;
}

function readVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
    cachedVersion = String(pkg.version ?? '0.0.0');
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

/**
 * Fire-and-forget event recorder. Catches every error path so an unwritable
 * sink can never affect the calling tool. Does nothing when disabled.
 */
export async function recordToolCall(
  tool: string,
  durationMs: number,
  ok: boolean,
  errorCode?: string,
  rcConfig?: { enabled?: boolean; sink?: string },
): Promise<void> {
  const config = resolveTelemetryConfig(rcConfig);
  if (!config.enabled) return;

  const event: TelemetryEvent = {
    ts: new Date().toISOString(),
    version: readVersion(),
    tool,
    durationMs: Math.round(durationMs),
    ok,
  };
  if (errorCode) event.errorCode = errorCode;

  try {
    if (config.sink === 'stderr') {
      process.stderr.write(`[telemetry] ${JSON.stringify(event)}\n`);
      return;
    }
    await fs.mkdir(path.dirname(config.sink), { recursive: true });
    await fs.appendFile(config.sink, JSON.stringify(event) + '\n', 'utf-8');
  } catch {
    // Sink failures are silent by design. Telemetry must never break a tool.
  }
}

/** Returns the JSON used by `projscan_telemetry` to surface state to the user. */
export function describeTelemetryConfig(rcConfig?: {
  enabled?: boolean;
  sink?: string;
}): TelemetryConfig & { defaultSink: string; envOverride: string | null } {
  const config = resolveTelemetryConfig(rcConfig);
  const env = process.env.PROJSCAN_TELEMETRY ?? null;
  return {
    ...config,
    defaultSink: DEFAULT_SINK_FILE,
    envOverride: env,
  };
}
