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

// ── Aggregation (histograms) ──────────────────────────────

export interface ToolHistogram {
  tool: string;
  count: number;
  errorCount: number;
  errorRate: number;
  /** Latency percentiles (ms). null when count is 0 (shouldn't happen post-filter). */
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

export interface TelemetryAggregate {
  available: boolean;
  reason?: string;
  sink: string;
  totalEvents: number;
  windowFrom: string | null;
  windowTo: string | null;
  byTool: ToolHistogram[];
}

/**
 * Read the JSONL sink and bucket events by tool, returning latency
 * percentiles per tool. Returns available:false (with a reason) when the
 * sink doesn't exist yet — typical case for users who haven't enabled
 * telemetry or haven't run anything yet.
 */
export async function aggregateTelemetry(rcConfig?: {
  enabled?: boolean;
  sink?: string;
}): Promise<TelemetryAggregate> {
  const config = resolveTelemetryConfig(rcConfig);
  const sinkPath = config.sink === 'stderr' ? '' : config.sink;

  if (!sinkPath) {
    return {
      available: false,
      reason: 'Sink is "stderr"; nothing to aggregate from disk.',
      sink: config.sink,
      totalEvents: 0,
      windowFrom: null,
      windowTo: null,
      byTool: [],
    };
  }

  let raw: string;
  try {
    raw = await fs.readFile(sinkPath, 'utf-8');
  } catch {
    return {
      available: false,
      reason: `No telemetry sink found at ${sinkPath}. Enable telemetry and run a few tools first.`,
      sink: sinkPath,
      totalEvents: 0,
      windowFrom: null,
      windowTo: null,
      byTool: [],
    };
  }

  const events: TelemetryEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as TelemetryEvent;
      if (typeof obj?.tool === 'string' && typeof obj?.durationMs === 'number') {
        events.push(obj);
      }
    } catch {
      // Skip malformed lines silently — JSONL files can be partially written
      // when a process is killed mid-append.
    }
  }

  if (events.length === 0) {
    return {
      available: true,
      sink: sinkPath,
      totalEvents: 0,
      windowFrom: null,
      windowTo: null,
      byTool: [],
    };
  }

  const byToolMap = new Map<string, TelemetryEvent[]>();
  let windowFrom = events[0].ts;
  let windowTo = events[0].ts;
  for (const e of events) {
    if (e.ts < windowFrom) windowFrom = e.ts;
    if (e.ts > windowTo) windowTo = e.ts;
    if (!byToolMap.has(e.tool)) byToolMap.set(e.tool, []);
    byToolMap.get(e.tool)!.push(e);
  }

  const byTool: ToolHistogram[] = [];
  for (const [tool, toolEvents] of byToolMap) {
    const durations = toolEvents.map((e) => e.durationMs).sort((a, b) => a - b);
    const errorCount = toolEvents.filter((e) => e.ok === false).length;
    byTool.push({
      tool,
      count: toolEvents.length,
      errorCount,
      errorRate: Math.round((errorCount / toolEvents.length) * 1000) / 1000,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      p99Ms: percentile(durations, 99),
      meanMs: Math.round(durations.reduce((s, n) => s + n, 0) / durations.length),
      minMs: durations[0],
      maxMs: durations[durations.length - 1],
    });
  }
  byTool.sort((a, b) => b.count - a.count);

  return {
    available: true,
    sink: sinkPath,
    totalEvents: events.length,
    windowFrom,
    windowTo,
    byTool,
  };
}

/** Linear-interpolation percentile over a pre-sorted ascending array. */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}
