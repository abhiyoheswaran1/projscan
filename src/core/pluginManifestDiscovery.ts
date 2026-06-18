import fs from 'node:fs/promises';
import path from 'node:path';
import { validateManifest } from './pluginManifestValidation.js';
import type { PluginDiagnostic, PluginManifest } from './pluginManifestValidation.js';

export const PLUGIN_DIR = '.projscan-plugins';
export const PLUGIN_MANIFEST_EXT = '.projscan-plugin.json';

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

export async function readPluginManifestFile(
  manifestPath: string,
): Promise<PluginManifestFileResult> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    const message = `unable to read manifest: ${formatError(err)}`;
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
    const message = `invalid JSON: ${formatError(err)}`;
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

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
