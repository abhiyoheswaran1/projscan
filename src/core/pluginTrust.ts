import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteFile } from '../utils/atomicWrite.js';

/**
 * Plugin trust-on-first-use (TOFU) store.
 *
 * The plugin preview (PROJSCAN_PLUGINS_PREVIEW=1) executes JavaScript from the
 * SCANNED repository's `.projscan-plugins/` directory. The env flag is a coarse
 * on/off switch; once a user sets it (e.g. globally in a shell profile), every
 * repo they later scan could silently run attacker-authored code.
 *
 * TOFU narrows that: a plugin module only executes if its exact bytes have been
 * explicitly approved via `projscan plugin trust <name>`. Approval is recorded
 * as a SHA-256 of the module file, keyed by its canonical (realpath) location.
 * If the module's content later changes, it reverts to "changed" (untrusted)
 * and must be re-approved — so a trusted plugin can't be swapped for a hostile
 * payload behind the user's back.
 *
 * SECURITY-CRITICAL: the store lives OUTSIDE any scanned repo (user config dir,
 * overridable for tests via PROJSCAN_PLUGIN_TRUST_HOME). A repo-local store
 * would let a malicious repo ship a pre-seeded trust file that auto-approves
 * its own plugin, defeating the whole mechanism.
 */

export const PLUGIN_TRUST_HOME_ENV = 'PROJSCAN_PLUGIN_TRUST_HOME';
const TRUST_FILE = 'plugin-trust.json';
const SCHEMA_VERSION = 1;

export type PluginTrustStatus = 'trusted' | 'untrusted' | 'changed';

export interface PluginTrustEntry {
  /** Canonical (realpath) absolute path of the approved module file. */
  modulePath: string;
  /** SHA-256 of the module file's bytes at the time it was trusted. */
  sha256: string;
  /** Plugin name from the manifest, for human-readable listings. */
  name: string;
  /** ISO timestamp of approval. */
  trustedAt: string;
}

export interface PluginTrustResult {
  status: PluginTrustStatus;
  /** Hash of the module file as it exists on disk now; null if unreadable. */
  sha256: string | null;
  /** The stored approval for this module path, if any. */
  entry: PluginTrustEntry | null;
}

interface PluginTrustStore {
  schemaVersion: number;
  entries: PluginTrustEntry[];
}

function trustHomeDir(): string {
  const override = process.env[PLUGIN_TRUST_HOME_ENV];
  if (override) return path.resolve(override);
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'projscan');
  return path.join(os.homedir(), '.config', 'projscan');
}

function trustFilePath(): string {
  return path.join(trustHomeDir(), TRUST_FILE);
}

/** Canonical key for a module path: realpath if it exists, else resolved. */
async function canonicalize(modulePath: string): Promise<string> {
  try {
    return await fs.realpath(modulePath);
  } catch {
    return path.resolve(modulePath);
  }
}

/** SHA-256 of a file's bytes, or null when the file can't be read. */
export async function hashModuleFile(modulePath: string): Promise<string | null> {
  try {
    const bytes = await fs.readFile(modulePath);
    return crypto.createHash('sha256').update(bytes).digest('hex');
  } catch {
    return null;
  }
}

async function readStore(): Promise<PluginTrustStore> {
  try {
    const raw = await fs.readFile(trustFilePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PluginTrustStore>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries.filter(isWellShapedEntry) : [];
    return { schemaVersion: SCHEMA_VERSION, entries };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, entries: [] };
  }
}

async function writeStore(store: PluginTrustStore): Promise<void> {
  const dir = trustHomeDir();
  await fs.mkdir(dir, { recursive: true });
  await atomicWriteFile(trustFilePath(), JSON.stringify(store, null, 2) + '\n');
}

function isWellShapedEntry(value: unknown): value is PluginTrustEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.modulePath === 'string' &&
    typeof e.sha256 === 'string' &&
    typeof e.name === 'string' &&
    typeof e.trustedAt === 'string'
  );
}

/**
 * Determine whether a plugin module is trusted to execute. Compares the module
 * file's current hash against the approved hash recorded for its canonical path.
 */
export async function getPluginTrustStatus(modulePath: string): Promise<PluginTrustResult> {
  const key = await canonicalize(modulePath);
  const [store, sha256] = await Promise.all([readStore(), hashModuleFile(modulePath)]);
  const entry = store.entries.find((e) => e.modulePath === key) ?? null;

  if (!entry) return { status: 'untrusted', sha256, entry: null };
  if (sha256 !== null && sha256 === entry.sha256) return { status: 'trusted', sha256, entry };
  return { status: 'changed', sha256, entry };
}

/**
 * Record approval for the module's current bytes. Upserts by canonical path, so
 * re-trusting after a content change replaces the stale hash. Throws if the
 * module file cannot be read (you cannot approve a module that isn't there).
 */
export async function trustPlugin(modulePath: string, name: string): Promise<PluginTrustEntry> {
  const key = await canonicalize(modulePath);
  const sha256 = await hashModuleFile(modulePath);
  if (sha256 === null) {
    throw new Error(`Cannot trust "${modulePath}": module file is unreadable or missing.`);
  }
  const entry: PluginTrustEntry = {
    modulePath: key,
    sha256,
    name,
    trustedAt: new Date().toISOString(),
  };
  const store = await readStore();
  store.entries = store.entries.filter((e) => e.modulePath !== key);
  store.entries.push(entry);
  await writeStore(store);
  return entry;
}

/** Remove a module's approval. Returns true if an entry was removed. */
export async function untrustPlugin(modulePath: string): Promise<boolean> {
  const key = await canonicalize(modulePath);
  const store = await readStore();
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.modulePath !== key);
  if (store.entries.length === before) return false;
  await writeStore(store);
  return true;
}

/** All recorded approvals. */
export async function listTrustedPlugins(): Promise<PluginTrustEntry[]> {
  return (await readStore()).entries;
}
