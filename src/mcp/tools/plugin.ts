import path from 'node:path';
import type { McpTool } from './_shared.js';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
} from '../../core/plugins.js';

/**
 * `projscan_plugin` (1.10+ preview) — discover and validate third-party
 * analyzer plugins under `<root>/.projscan-plugins/*.projscan-plugin.json`.
 *
 * Behind the PROJSCAN_PLUGINS_PREVIEW=1 feature flag. The tool is always
 * registered (so agents can probe for it), but `action:"list"` returns
 * `enabled:false` and an empty list when the flag is off, so callers can
 * detect that the preview is dark without an extra `enabled` check.
 *
 * The plugin schema and discovery path may still change before 2.0.
 */
export const pluginTool: McpTool = {
  name: 'projscan_plugin',
  description:
    '1.10+ preview. Discover and validate third-party analyzer plugins under .projscan-plugins/. Gated by the PROJSCAN_PLUGINS_PREVIEW=1 env flag; the schema is preview-only and may shift before 2.0. Use action:"list" to see what is discoverable today, action:"validate" to check a manifest before committing it.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'validate'],
        description:
          '"list" enumerates manifests under <root>/.projscan-plugins/ with discovery status. "validate" lints a manifest at the given path against the 1.10 schema.',
      },
      manifest_path: {
        type: 'string',
        description: '"validate" only — repo-relative or absolute path to a *.projscan-plugin.json file.',
      },
    },
  },
  handler: async (args, rootPath) => {
    const action = typeof args.action === 'string' ? args.action : 'list';
    switch (action) {
      case 'list': {
        const entries = await discoverPluginManifests(rootPath);
        return {
          enabled: pluginsEnabled(),
          envFlag: PLUGIN_PREVIEW_FLAG,
          count: entries.length,
          plugins: entries.map((e) => ({
            manifestPath: e.manifestPath,
            ok: e.manifest !== null,
            ...(e.manifest
              ? {
                  name: e.manifest.name,
                  kind: e.manifest.kind,
                  module: e.manifest.module,
                  category: e.manifest.category,
                  description: e.manifest.description,
                }
              : { error: e.error, diagnostic: e.diagnostic }),
          })),
        };
      }
      case 'validate': {
        const p = typeof args.manifest_path === 'string' ? args.manifest_path : '';
        if (!p) throw new Error('validate action requires a "manifest_path" argument');
        const manifestPath = path.isAbsolute(p) ? p : path.resolve(rootPath, p);
        const result = await readPluginManifestFile(manifestPath);
        return result.ok
          ? { ok: true, manifest: result.manifest }
          : { ok: false, error: result.reason, diagnostic: result.diagnostic };
      }
      default:
        throw new Error(`Unknown action "${action}". Known: list, validate.`);
    }
  },
};
