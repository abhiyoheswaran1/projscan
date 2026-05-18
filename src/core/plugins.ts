import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FileEntry, Issue, IssueSeverity } from '../types.js';

/**
 * Plugin API preview (1.10+).
 *
 * Gated behind PROJSCAN_PLUGINS_PREVIEW=1. The shape declared here is what
 * 2.0 will commit to; until 2.0 ships, the schema, the discovery path,
 * and the dispatch lifecycle may change between minors. Without the env
 * flag, `loadPlugins()` returns [] and projscan ignores any manifests on
 * disk — so a half-written plugin can't accidentally light up.
 *
 * Goal for 2.0: third parties write `.projscan-plugin.json` declaring an
 * analyzer that produces Issue[], projscan dispatches to it during
 * `doctor` / `ci` / `analyze`, and the issue stream merges with the
 * built-ins. No LLM inside; no codemods; mechanical only — same scope
 * discipline as the rest of projscan.
 */

export const PLUGIN_PREVIEW_FLAG = 'PROJSCAN_PLUGINS_PREVIEW';
export const PLUGIN_SCHEMA_VERSION = 1;
export const PLUGIN_DIR = '.projscan-plugins';
export const PLUGIN_MANIFEST_EXT = '.projscan-plugin.json';

export type PluginKind = 'analyzer';

export interface PluginManifest {
  schemaVersion: number;
  name: string;
  kind: PluginKind;
  /** Module entry point, relative to the manifest file. */
  module: string;
  /** Issue category emitted by this plugin (`Issue.category`). */
  category: string;
  /** Optional human-readable summary. */
  description?: string;
}

export interface PluginAnalyzerExports {
  check: (rootPath: string, files: FileEntry[]) => Promise<Issue[]> | Issue[];
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  /** Absolute path to the manifest file on disk. */
  manifestPath: string;
  /** Absolute path to the resolved module entry point. */
  modulePath: string;
  exports: PluginAnalyzerExports;
}

export interface PluginDiscoveryEntry {
  manifestPath: string;
  manifest: PluginManifest | null;
  /** Set when the manifest failed to parse or validate. */
  error?: string;
  diagnostic?: PluginDiagnostic;
}

export type PluginManifestFileResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; reason: string; diagnostic: PluginDiagnostic };

export function pluginsEnabled(): boolean {
  const v = process.env[PLUGIN_PREVIEW_FLAG];
  return v === '1' || v === 'true';
}

export async function readPluginManifestFile(manifestPath: string): Promise<PluginManifestFileResult> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    const message = `unable to read manifest: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ok: false,
      reason: message,
      diagnostic: {
        code: 'read-error',
        message,
        hint: 'Check file permissions and try again.',
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = `invalid JSON: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ok: false,
      reason: message,
      diagnostic: {
        code: 'invalid-json',
        message,
        hint: 'Fix the manifest so it is valid JSON.',
      },
    };
  }

  const validation = validateManifest(parsed);
  return validation.ok
    ? { ok: true, manifest: validation.manifest }
    : { ok: false, reason: validation.reason, diagnostic: validation.diagnostic };
}

/**
 * Discover every plugin manifest under `<root>/.projscan-plugins/`. Manifests
 * that fail to parse or validate are returned with `manifest: null` and an
 * `error` so the CLI / MCP tool can surface them without throwing.
 */
export async function discoverPluginManifests(rootPath: string): Promise<PluginDiscoveryEntry[]> {
  const dir = path.join(rootPath, PLUGIN_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: PluginDiscoveryEntry[] = [];
  for (const name of entries.sort()) {
    if (!name.endsWith(PLUGIN_MANIFEST_EXT)) continue;
    const manifestPath = path.join(dir, name);
    const result = await readPluginManifestFile(manifestPath);
    if (!result.ok) {
      out.push({
        manifestPath,
        manifest: null,
        error: result.reason,
        diagnostic: result.diagnostic,
      });
      continue;
    }
    out.push({ manifestPath, manifest: result.manifest });
  }
  return out;
}

/**
 * Discover, validate, and dynamically import every plugin under the
 * project. Returns [] when the preview flag is off.
 *
 * Errors loading an individual plugin are isolated: that plugin is
 * skipped (with a console.warn on stderr) but other plugins still load.
 * We never let one bad plugin break the projscan pipeline.
 */
export async function loadPlugins(rootPath: string): Promise<LoadedPlugin[]> {
  if (!pluginsEnabled()) return [];
  const discovered = await discoverPluginManifests(rootPath);
  const loaded: LoadedPlugin[] = [];
  for (const entry of discovered) {
    if (!entry.manifest) continue;
    const modulePath = path.resolve(path.dirname(entry.manifestPath), entry.manifest.module);
    try {
      const mod = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
      const exportsObj = (mod.default ?? mod) as Partial<PluginAnalyzerExports>;
      if (typeof exportsObj.check !== 'function') {
        process.stderr.write(
          `[projscan] plugin "${entry.manifest.name}" missing required export "check"; skipped.\n`,
        );
        continue;
      }
      loaded.push({
        manifest: entry.manifest,
        manifestPath: entry.manifestPath,
        modulePath,
        exports: { check: exportsObj.check as PluginAnalyzerExports['check'] },
      });
    } catch (err) {
      process.stderr.write(
        `[projscan] plugin "${entry.manifest.name}" failed to load: ${err instanceof Error ? err.message : String(err)}. skipped.\n`,
      );
    }
  }
  return loaded;
}

/**
 * Run every loaded analyzer plugin against `files`. Issues that don't pass
 * a tight shape check are dropped so a malformed plugin can't poison the
 * issue stream. Each plugin's output is also re-stamped with `id` prefixed
 * by the plugin name (so two plugins emitting the same local rule id can't
 * collide).
 */
export async function runAnalyzerPlugins(
  plugins: LoadedPlugin[],
  rootPath: string,
  files: FileEntry[],
): Promise<Issue[]> {
  const out: Issue[] = [];
  for (const p of plugins) {
    let raw: Issue[];
    try {
      raw = (await p.exports.check(rootPath, files)) ?? [];
    } catch (err) {
      process.stderr.write(
        `[projscan] plugin "${p.manifest.name}" threw during check: ${err instanceof Error ? err.message : String(err)}. ignored for this run.\n`,
      );
      continue;
    }
    for (const issue of raw) {
      if (!isWellShapedIssue(issue)) continue;
      out.push({
        ...issue,
        id: `plugin:${p.manifest.name}:${issue.id}`,
        category: issue.category || p.manifest.category,
      });
    }
  }
  return out;
}

export interface PluginDiagnostic {
  code:
    | 'invalid-manifest'
    | 'unsupported-schema-version'
    | 'invalid-name'
    | 'unsupported-kind'
    | 'invalid-module'
    | 'invalid-category'
    | 'invalid-description'
    | 'invalid-json'
    | 'read-error';
  message: string;
  field?: string;
  hint?: string;
}

interface ValidationOk {
  ok: true;
  manifest: PluginManifest;
}
interface ValidationFail {
  ok: false;
  reason: string;
  diagnostic: PluginDiagnostic;
}

function failValidation(diagnostic: PluginDiagnostic): ValidationFail {
  return { ok: false, reason: diagnostic.message, diagnostic };
}

export function validateManifest(input: unknown): ValidationOk | ValidationFail {
  if (!input || typeof input !== 'object') {
    return failValidation({
      code: 'invalid-manifest',
      message: 'manifest must be a JSON object',
      hint: 'Use an object with schemaVersion, name, kind, module, and category fields.',
    });
  }
  const obj = input as Record<string, unknown>;
  if (obj.schemaVersion !== PLUGIN_SCHEMA_VERSION) {
    return failValidation({
      code: 'unsupported-schema-version',
      field: 'schemaVersion',
      message: `unsupported schemaVersion ${String(obj.schemaVersion)}; expected ${PLUGIN_SCHEMA_VERSION}`,
      hint: `Set "schemaVersion": ${PLUGIN_SCHEMA_VERSION}.`,
    });
  }
  if (typeof obj.name !== 'string' || !/^[a-z0-9][a-z0-9._/-]{0,64}$/i.test(obj.name)) {
    return failValidation({
      code: 'invalid-name',
      field: 'name',
      message: 'name is required and must be 1-65 chars of [a-z0-9._/-]',
      hint: 'Use a stable 1-65 character plugin id such as "team/no-console" or "my-plugin".',
    });
  }
  if (obj.kind !== 'analyzer') {
    return failValidation({
      code: 'unsupported-kind',
      field: 'kind',
      message: 'only kind:"analyzer" is supported in the plugin preview',
      hint: 'Set "kind": "analyzer".',
    });
  }
  if (typeof obj.module !== 'string' || obj.module.length === 0) {
    return failValidation({
      code: 'invalid-module',
      field: 'module',
      message: 'module is required and must be a relative path',
      hint: 'Point to a local module inside the same plugin directory, for example "./check.mjs".',
    });
  }
  // Path-traversal guard. Modules must resolve under the manifest's own dir.
  if (path.isAbsolute(obj.module) || obj.module.split(/[/\\]/).some((seg) => seg === '..')) {
    return failValidation({
      code: 'invalid-module',
      field: 'module',
      message: 'module must be a relative path inside the plugin dir',
      hint: 'Do not use absolute paths or any ".." path segment.',
    });
  }
  if (typeof obj.category !== 'string' || obj.category.length === 0) {
    return failValidation({
      code: 'invalid-category',
      field: 'category',
      message: 'category is required',
      hint: 'Use the fallback Issue.category for this plugin, for example "custom" or "security".',
    });
  }
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return failValidation({
      code: 'invalid-description',
      field: 'description',
      message: 'description must be a string when provided',
    });
  }
  return {
    ok: true,
    manifest: {
      schemaVersion: obj.schemaVersion,
      name: obj.name,
      kind: obj.kind,
      module: obj.module,
      category: obj.category,
      ...(typeof obj.description === 'string' ? { description: obj.description } : {}),
    },
  };
}

function isWellShapedIssue(x: unknown): x is Issue {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.id !== 'string' || obj.id.length === 0) return false;
  if (typeof obj.title !== 'string') return false;
  if (typeof obj.description !== 'string') return false;
  if (!isSeverity(obj.severity)) return false;
  if (typeof obj.category !== 'string') return false;
  if (typeof obj.fixAvailable !== 'boolean') return false;
  return true;
}

function isSeverity(x: unknown): x is IssueSeverity {
  return x === 'error' || x === 'warning' || x === 'info';
}
