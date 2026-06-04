import fs from 'node:fs/promises';
import path from 'node:path';
import type { McpTool } from './_shared.js';
import {
  PLUGIN_DIR,
  PLUGIN_MANIFEST_EXT,
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
} from '../../core/plugins.js';

/**
 * `projscan_plugin` — discover and validate stable local analyzer/reporter
 * plugins under `<root>/.projscan-plugins/*.projscan-plugin.json`.
 *
 * Execution remains opt-in via PROJSCAN_PLUGINS_PREVIEW=1 because plugins are
 * local code. The tool is always registered so agents can discover and
 * validate manifests before enabling execution.
 */
export const pluginTool: McpTool = {
  name: 'projscan_plugin',
  description:
    'Discover and validate stable local analyzer and reporter plugins under .projscan-plugins/. Execution is opt-in via the PROJSCAN_PLUGINS_PREVIEW=1 env flag because plugins are local code. Use action:"list" to see what is discoverable today, action:"validate" to check a manifest before committing it.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'validate'],
        description:
          '"list" enumerates manifests under <root>/.projscan-plugins/ with discovery status. "validate" lints a manifest at the given path against schema v1.',
      },
      manifest_path: {
        type: 'string',
        description: '"validate" only — repo-relative path under .projscan-plugins/ to a *.projscan-plugin.json file.',
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
                  ...(e.manifest.kind === 'analyzer'
                    ? { category: e.manifest.category }
                    : { commands: e.manifest.commands }),
                  description: e.manifest.description,
                }
              : { error: e.error, diagnostic: e.diagnostic }),
          })),
        };
      }
      case 'validate': {
        const p = typeof args.manifest_path === 'string' ? args.manifest_path : '';
        if (!p) throw new Error('validate action requires a "manifest_path" argument');
        const resolved = await resolveMcpManifestPath(rootPath, p);
        if (!resolved.ok) return resolved.failure;
        const result = await readPluginManifestFile(resolved.manifestPath);
        return result.ok
          ? { ok: true, manifest: result.manifest }
          : { ok: false, error: result.reason, diagnostic: result.diagnostic };
      }
      default:
        throw new Error(`Unknown action "${action}". Known: list, validate.`);
    }
  },
};


type ManifestPathResolution =
  | { ok: true; manifestPath: string }
  | { ok: false; failure: Record<string, unknown> };

async function resolveMcpManifestPath(rootPath: string, inputPath: string): Promise<ManifestPathResolution> {
  if (path.isAbsolute(inputPath)) {
    return invalidManifestPath('manifest_path must be relative to the project root');
  }
  if (inputPath.split(/[/\\]/).some((segment) => segment === '..')) {
    return invalidManifestPath('manifest_path must not contain ".." path segments');
  }
  if (!inputPath.endsWith(PLUGIN_MANIFEST_EXT)) {
    return invalidManifestPath(`manifest_path must end with ${PLUGIN_MANIFEST_EXT}`);
  }

  const rootReal = await fs.realpath(rootPath).catch(() => path.resolve(rootPath));
  const pluginDir = path.join(rootReal, PLUGIN_DIR);
  const pluginDirReal = await fs.realpath(pluginDir).catch(() => pluginDir);
  const candidate = path.resolve(rootReal, inputPath);
  if (!isInsideDirectory(candidate, pluginDirReal)) {
    return invalidManifestPath(`manifest_path must live under ${PLUGIN_DIR}/`);
  }

  const candidateReal = await fs.realpath(candidate).catch(() => candidate);
  if (!isInsideDirectory(candidateReal, pluginDirReal)) {
    return invalidManifestPath(`manifest_path must resolve under ${PLUGIN_DIR}/`);
  }
  return { ok: true, manifestPath: candidateReal };
}

function isInsideDirectory(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function invalidManifestPath(message: string): ManifestPathResolution {
  return {
    ok: false,
    failure: {
      ok: false,
      error: message,
      diagnostic: {
        code: 'invalid-manifest-path',
        message,
        hint: `Use a path like ${PLUGIN_DIR}/policy${PLUGIN_MANIFEST_EXT}.`,
      },
    },
  };
}
