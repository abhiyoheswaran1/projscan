import type { FileEntry, Issue } from '../types.js';
import { loadAnalyzerPluginEntry } from './pluginAnalyzerLoading.js';
import { isWellShapedIssue } from './pluginIssueValidation.js';
import { discoverPluginManifests } from './pluginManifestDiscovery.js';
import { resolveReporterPlugin as resolveReporterPluginEntry } from './pluginReporterLoading.js';
import type { PluginReporterResolveResult } from './pluginReporterLoading.js';
import type { LoadedPlugin, PluginAnalyzerContext } from './pluginRuntimeTypes.js';
import type { PluginReporterCommand } from './pluginManifestValidation.js';

/**
 * Stable local plugin API (2.0+).
 *
 * Gated behind PROJSCAN_PLUGINS_PREVIEW=1 as an explicit local-code trust
 * boundary. Without the env flag, `loadPlugins()` returns [] and projscan
 * ignores manifests on disk, so a half-written plugin cannot accidentally
 * affect a scan.
 *
 * Goal for 2.0: third parties write `.projscan-plugin.json` declaring an
 * analyzer that produces Issue[], projscan dispatches to it during
 * `doctor` / `ci` / `analyze`, and the issue stream merges with the
 * built-ins. No LLM inside; no codemods; mechanical only — same scope
 * discipline as the rest of projscan.
 */

export const PLUGIN_PREVIEW_FLAG = 'PROJSCAN_PLUGINS_PREVIEW';
export {
  PLUGIN_DIR,
  PLUGIN_MANIFEST_EXT,
  discoverPluginManifests,
  readPluginManifestFile,
} from './pluginManifestDiscovery.js';
export type { PluginDiscoveryEntry, PluginManifestFileResult } from './pluginManifestDiscovery.js';
export type {
  LoadedPlugin,
  PluginAnalyzerContext,
  PluginAnalyzerExports,
} from './pluginRuntimeTypes.js';
export {
  PLUGIN_REPORTER_COMMANDS,
  PLUGIN_SCHEMA_VERSION,
  validateManifest,
} from './pluginManifestValidation.js';
export type {
  PluginAnalyzerManifest,
  PluginDiagnostic,
  PluginKind,
  PluginManifest,
  PluginReporterCommand,
  PluginReporterManifest,
} from './pluginManifestValidation.js';
export { renderReporterPlugin } from './pluginReporterLoading.js';
export type {
  LoadedReporterPlugin,
  PluginReporterContext,
  PluginReporterExports,
  PluginReporterRenderResult,
  PluginReporterResolveResult,
} from './pluginReporterLoading.js';

export function pluginsEnabled(): boolean {
  const v = process.env[PLUGIN_PREVIEW_FLAG];
  return v === '1' || v === 'true';
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
    const plugin = await loadAnalyzerPluginEntry(entry);
    if (plugin) loaded.push(plugin);
  }
  return loaded;
}

export async function resolveReporterPlugin(
  rootPath: string,
  reporterName: string,
  command: PluginReporterCommand,
): Promise<PluginReporterResolveResult> {
  return resolveReporterPluginEntry(rootPath, reporterName, command, {
    pluginsEnabled: pluginsEnabled(),
    previewFlag: PLUGIN_PREVIEW_FLAG,
  });
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
  context?: PluginAnalyzerContext,
): Promise<Issue[]> {
  const out: Issue[] = [];
  for (const p of plugins) {
    let raw: Issue[];
    try {
      raw = (await p.exports.check(rootPath, files, context)) ?? [];
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
