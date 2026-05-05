import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Project Memory — a local feedback loop that learns which issues the
 * user has effectively accepted (by leaving them open across many
 * `projscan ci` / `projscan doctor` runs) and surfaces that signal so
 * projscan can lower the noise on this specific repo over time.
 *
 * Stored at `.projscan-memory/memory.json` (sibling of the existing
 * graph + session caches). Local-only; never phones home; honours
 * .gitignore by living under the same directory family.
 *
 * Schema versioned so future evolutions can detect and migrate.
 *
 * Design principles:
 *   - Best-effort writes: a transient disk error never breaks a tool.
 *   - Idempotent recording: replaying the same observation is safe.
 *   - Bounded growth: per-rule history caps; rules unseen for 90 days
 *     are aged out.
 *   - Privacy: only stores rule ids and timestamps. No source content,
 *     no agent identity, no machine identifiers.
 */

export const MEMORY_SCHEMA_VERSION = 1;
const MEMORY_DIR = '.projscan-memory';
const MEMORY_FILENAME = 'memory.json';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Drop rules unseen for this many days. */
export const STALE_RULE_DAYS = 90;

/**
 * "Stable" threshold: an issue that has appeared in ≥ this many runs
 * over ≥ STABLE_RULE_DAYS days without being addressed is treated as
 * accepted by the user. Tunable per-project via `.projscanrc.memory`
 * in a future release.
 */
export const STABLE_RULE_RUN_COUNT = 3;
export const STABLE_RULE_DAYS = 7;

/**
 * "Accepted hotspot" thresholds — a file ranked top-K in hotspots for
 * ≥ HOT_RUN_COUNT runs over ≥ HOT_DAYS days, without its CC or churn
 * dropping, is treated as accepted load-bearing debt. The hotspot
 * reporter will tag it as `[accepted]` instead of repeated noise.
 */
export const HOT_RUN_COUNT = 5;
export const HOT_DAYS = 7;

export interface HotspotObservation {
  /** Repo-relative path. */
  file: string;
  /** ISO 8601 of first time we saw this file in the top-K hotspots. */
  firstSeenAt: string;
  /** ISO 8601 of most recent sighting. */
  lastSeenAt: string;
  /** Total runs that put this file in the top-K. */
  runCount: number;
  /** Last-recorded CC (file-level). Used to detect "the file is improving." */
  lastCc: number | null;
  /** Last-recorded churn count. */
  lastChurn: number;
}

export interface RuleObservation {
  /** Stable rule id (e.g. `unused-dependency-foo`, `cycle-detected-3`). */
  ruleId: string;
  /** ISO 8601 timestamp of first time we saw this rule. */
  firstSeenAt: string;
  /** ISO 8601 timestamp of most recent time we saw this rule. */
  lastSeenAt: string;
  /** Total number of distinct runs that surfaced this rule. */
  runCount: number;
  /**
   * Heuristic: the rule WAS surfaced in run N but NOT in run N+1.
   * Increments whenever we observe that disappearance. High values
   * signal "user actively fixes these"; zero signals "this is
   * background noise to them."
   */
  fixedCount: number;
  /**
   * True if the user explicitly suppressed the rule via .projscanrc
   * `disableRules`. Recorded so `projscan memory forget` can surface
   * them as already-quieted.
   */
  suppressedInConfig: boolean;
}

export interface ProjectMemory {
  schemaVersion: number;
  /** ISO 8601. Updated on every save. */
  lastUpdatedAt: string;
  /**
   * Per-rule history keyed by rule id. Rules unseen for STALE_RULE_DAYS
   * are dropped on next save.
   */
  rules: Record<string, RuleObservation>;
  /**
   * 1.5+ — per-hotspot history keyed by repo-relative path. Files
   * unseen for STALE_RULE_DAYS are aged out alongside rules.
   */
  hotspots?: Record<string, HotspotObservation>;
  /**
   * Total runs of `projscan doctor` / `projscan ci` against this repo
   * since memory began. Used to compute fix-rate: a rule's fixedCount
   * vs. the run count over its lifetime.
   */
  totalRuns: number;
}

/**
 * Load the project memory for `rootPath`. Returns a fresh empty
 * memory object if the file is missing, corrupt, or has an
 * unrecognised schema version. Never throws.
 */
export async function loadMemory(rootPath: string): Promise<ProjectMemory> {
  const filePath = memoryFilePath(rootPath);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return createFresh();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createFresh();
  }
  if (!isMemoryShape(parsed) || parsed.schemaVersion !== MEMORY_SCHEMA_VERSION) {
    return createFresh();
  }
  // 1.5+ — older saves predate the hotspots field. Backfill it so
  // callers can rely on the property being present.
  if (!parsed.hotspots) parsed.hotspots = {};
  return parsed;
}

/**
 * Persist the memory back to disk. Best-effort: failures are
 * swallowed. Mirrors the session module's last-write-wins semantics.
 */
export async function saveMemory(rootPath: string, memory: ProjectMemory): Promise<void> {
  try {
    const dir = path.join(rootPath, MEMORY_DIR);
    await fs.mkdir(dir, { recursive: true });
    const filePath = memoryFilePath(rootPath);
    memory.lastUpdatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
  } catch {
    // best-effort
  }
}

/**
 * Record one analyzer run's worth of issues. Called by the issue
 * engine once per `projscan doctor` / `projscan ci` execution.
 *
 * `currentIds` is the set of rule ids surfaced in this run.
 * `suppressedIds` is the set of rule ids the user has explicitly
 * silenced via `.projscanrc disableRules`. Both lists are intersected
 * with the existing memory to compute fix events: any rule in memory
 * that was active last run but is now absent counts as "fixed."
 *
 * Mutates the memory in place; caller is responsible for `saveMemory`.
 */
export function recordRun(
  memory: ProjectMemory,
  currentIds: Iterable<string>,
  suppressedIds: Iterable<string> = [],
): void {
  const nowIso = new Date().toISOString();
  const currentSet = new Set(currentIds);
  const suppressedSet = new Set(suppressedIds);

  // Increment fixedCount for any previously-tracked rule that did NOT
  // appear in this run AND wasn't merely suppressed.
  for (const [ruleId, obs] of Object.entries(memory.rules)) {
    const wasActiveLastRun =
      Date.parse(obs.lastSeenAt) >= Date.parse(memory.lastUpdatedAt) - MS_PER_DAY;
    if (!currentSet.has(ruleId) && !suppressedSet.has(ruleId) && wasActiveLastRun) {
      obs.fixedCount += 1;
    }
  }

  // Insert / update each currently-active rule.
  for (const ruleId of currentSet) {
    const existing = memory.rules[ruleId];
    if (existing) {
      existing.lastSeenAt = nowIso;
      existing.runCount += 1;
      existing.suppressedInConfig = suppressedSet.has(ruleId);
    } else {
      memory.rules[ruleId] = {
        ruleId,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        runCount: 1,
        fixedCount: 0,
        suppressedInConfig: suppressedSet.has(ruleId),
      };
    }
  }

  // Mark any rules that the user just suppressed via config (even if
  // they didn't fire this run).
  for (const ruleId of suppressedSet) {
    const existing = memory.rules[ruleId];
    if (existing) existing.suppressedInConfig = true;
  }

  memory.totalRuns += 1;
  ageOutStaleRules(memory);
}

/**
 * Identify rules the user has "effectively accepted" — surfaced
 * across ≥ STABLE_RULE_RUN_COUNT runs spanning ≥ STABLE_RULE_DAYS days
 * without ever being fixed (fixedCount = 0) and not already suppressed.
 *
 * These are the suggestions to surface in the doctor's "Tip" line.
 */
export function findStableRules(memory: ProjectMemory): RuleObservation[] {
  const now = Date.now();
  const stableMs = STABLE_RULE_DAYS * MS_PER_DAY;
  const out: RuleObservation[] = [];
  for (const obs of Object.values(memory.rules)) {
    if (obs.suppressedInConfig) continue;
    if (obs.fixedCount > 0) continue;
    if (obs.runCount < STABLE_RULE_RUN_COUNT) continue;
    const ageMs = now - Date.parse(obs.firstSeenAt);
    if (Number.isFinite(ageMs) && ageMs >= stableMs) out.push(obs);
  }
  // Most-stable first (longest-running and most-seen).
  out.sort((a, b) => b.runCount - a.runCount);
  return out;
}

/** Drop a single rule's history. Returns true if the rule existed. */
export function forgetRule(memory: ProjectMemory, ruleId: string): boolean {
  if (!memory.rules[ruleId]) return false;
  delete memory.rules[ruleId];
  return true;
}

/**
 * 1.5+ — record a hotspot run. `topFiles` is the list of paths
 * currently in the top-K of `projscan hotspots` along with their
 * file-level CC and churn counts. We track each file's appearance
 * history and the most-recent CC/churn so `findAcceptedHotspots` can
 * decide whether the file is genuinely stuck or actively improving.
 *
 * Mutates memory in place; caller is responsible for `saveMemory`.
 */
export function recordHotspots(
  memory: ProjectMemory,
  topFiles: ReadonlyArray<{ file: string; cc: number | null; churn: number }>,
): void {
  if (!memory.hotspots) memory.hotspots = {};
  const nowIso = new Date().toISOString();
  const seen = new Set<string>();
  for (const entry of topFiles) {
    seen.add(entry.file);
    const existing = memory.hotspots[entry.file];
    if (existing) {
      existing.lastSeenAt = nowIso;
      existing.runCount += 1;
      existing.lastCc = entry.cc;
      existing.lastChurn = entry.churn;
    } else {
      memory.hotspots[entry.file] = {
        file: entry.file,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        runCount: 1,
        lastCc: entry.cc,
        lastChurn: entry.churn,
      };
    }
  }
  memory.lastUpdatedAt = nowIso;
  // Age out hotspots not seen recently — same window as rules.
  const cutoff = Date.now() - STALE_RULE_DAYS * MS_PER_DAY;
  for (const [file, obs] of Object.entries(memory.hotspots)) {
    if (Date.parse(obs.lastSeenAt) < cutoff) delete memory.hotspots[file];
  }
}

/**
 * 1.5+ — files that have ranked in the top-K hotspots for ≥
 * HOT_RUN_COUNT runs over ≥ HOT_DAYS days. The hotspot reporter
 * surfaces these as `[accepted]` so the user isn't repeatedly
 * pestered about the same load-bearing debt.
 */
export function findAcceptedHotspots(memory: ProjectMemory): HotspotObservation[] {
  if (!memory.hotspots) return [];
  const now = Date.now();
  const minMs = HOT_DAYS * MS_PER_DAY;
  const out: HotspotObservation[] = [];
  for (const obs of Object.values(memory.hotspots)) {
    if (obs.runCount < HOT_RUN_COUNT) continue;
    const ageMs = now - Date.parse(obs.firstSeenAt);
    if (Number.isFinite(ageMs) && ageMs >= minMs) out.push(obs);
  }
  out.sort((a, b) => b.runCount - a.runCount);
  return out;
}

/** 1.5+ — drop a single hotspot's history (analogue of forgetRule). */
export function forgetHotspot(memory: ProjectMemory, file: string): boolean {
  if (!memory.hotspots || !memory.hotspots[file]) return false;
  delete memory.hotspots[file];
  return true;
}

function ageOutStaleRules(memory: ProjectMemory): void {
  const cutoff = Date.now() - STALE_RULE_DAYS * MS_PER_DAY;
  for (const [ruleId, obs] of Object.entries(memory.rules)) {
    if (Date.parse(obs.lastSeenAt) < cutoff) delete memory.rules[ruleId];
  }
}

function createFresh(): ProjectMemory {
  const iso = new Date().toISOString();
  return {
    schemaVersion: MEMORY_SCHEMA_VERSION,
    lastUpdatedAt: iso,
    rules: {},
    hotspots: {},
    totalRuns: 0,
  };
}

function memoryFilePath(rootPath: string): string {
  return path.join(rootPath, MEMORY_DIR, MEMORY_FILENAME);
}

function isMemoryShape(value: unknown): value is ProjectMemory {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === 'number' &&
    typeof v.lastUpdatedAt === 'string' &&
    typeof v.totalRuns === 'number' &&
    typeof v.rules === 'object'
  );
}
