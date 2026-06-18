import path from 'node:path';
import { discoverPluginManifests } from './pluginManifestDiscovery.js';
import type { PluginDiscoveryEntry } from './pluginManifestDiscovery.js';
import type {
  PluginDiagnostic,
  PluginReporterCommand,
  PluginReporterManifest,
} from './pluginManifestValidation.js';
import {
  assertPluginModuleReadable,
  describePluginModuleLoadError,
  importPluginModule,
} from './pluginModuleLoading.js';
import { getPluginTrustStatus, type PluginTrustStatus } from './pluginTrust.js';

export interface PluginReporterContext<TPayload = unknown> {
  command: PluginReporterCommand;
  rootPath: string;
  manifest: PluginReporterManifest;
  payload: TPayload;
}

export interface PluginReporterExports {
  render: (context: PluginReporterContext) => Promise<string> | string;
}

export interface LoadedReporterPlugin {
  manifest: PluginReporterManifest;
  /** Absolute path to the manifest file on disk. */
  manifestPath: string;
  /** Absolute path to the resolved module entry point. */
  modulePath: string;
  exports: PluginReporterExports;
}

export type PluginReporterResolveResult =
  | { ok: true; plugin: LoadedReporterPlugin }
  | { ok: false; reason: string; diagnostic: PluginDiagnostic };

export type PluginReporterRenderResult =
  | { ok: true; output: string }
  | { ok: false; reason: string; diagnostic: PluginDiagnostic };

export interface PluginReporterResolveOptions {
  pluginsEnabled: boolean;
  previewFlag: string;
}

export async function resolveReporterPlugin(
  rootPath: string,
  reporterName: string,
  command: PluginReporterCommand,
  options: PluginReporterResolveOptions,
): Promise<PluginReporterResolveResult> {
  if (!options.pluginsEnabled) {
    return pluginRuntimeFail({
      code: 'plugins-disabled',
      message: `reporter plugins require ${options.previewFlag}=1`,
      hint: `Set ${options.previewFlag}=1 in the environment to enable plugin reporters.`,
    });
  }

  const entries = await discoverPluginManifests(rootPath);
  const reporters = entries.filter(
    (entry): entry is PluginDiscoveryEntry & { manifest: PluginReporterManifest } =>
      entry.manifest?.kind === 'reporter',
  );
  const entry = reporters.find((candidate) => candidate.manifest.name === reporterName);
  if (!entry) {
    return pluginRuntimeFail({
      code: 'reporter-not-found',
      message: `reporter plugin "${reporterName}" was not found`,
      hint: 'Run `projscan plugin list` to see discovered reporter plugins.',
    });
  }

  if (!entry.manifest.commands.includes(command)) {
    return pluginRuntimeFail({
      code: 'reporter-unsupported-command',
      message: `reporter plugin "${reporterName}" does not support command "${command}"`,
      hint: `Add "${command}" to the reporter manifest's commands array or choose a different reporter.`,
    });
  }

  return loadReporterPlugin(entry.manifest, entry.manifestPath);
}

export async function renderReporterPlugin(
  plugin: LoadedReporterPlugin,
  context: PluginReporterContext,
): Promise<PluginReporterRenderResult> {
  try {
    const output = await plugin.exports.render(context);
    if (typeof output !== 'string') {
      return pluginRuntimeFail({
        code: 'reporter-render-error',
        message: `reporter plugin "${plugin.manifest.name}" returned ${typeof output}; expected string`,
        hint: 'Reporter render(context) must return text for stdout.',
      });
    }
    return { ok: true, output };
  } catch (err) {
    return pluginRuntimeFail({
      code: 'reporter-render-error',
      message: `reporter plugin "${plugin.manifest.name}" failed during render: ${formatError(err)}`,
      hint: 'Fix the reporter render(context) implementation and try again.',
    });
  }
}

export async function loadReporterPlugin(
  manifest: PluginReporterManifest,
  manifestPath: string,
): Promise<PluginReporterResolveResult> {
  const modulePath = path.resolve(path.dirname(manifestPath), manifest.module);
  try {
    await assertPluginModuleReadable(manifest.module, modulePath);
    // Importing a reporter executes local code, so trust must be checked first.
    const trust = await getPluginTrustStatus(modulePath);
    if (trust.status !== 'trusted') {
      return pluginRuntimeFail(untrustedReporterDiagnostic(manifest.name, trust.status));
    }
    const mod = await importPluginModule(modulePath);
    const exportsObj = (mod.default ?? mod) as Partial<PluginReporterExports>;
    if (typeof exportsObj.render !== 'function') {
      return pluginRuntimeFail({
        code: 'invalid-reporter-export',
        message: `reporter plugin "${manifest.name}" missing required export "render"`,
        hint: 'Use export default { render(context) { ... } } or export a named render function.',
      });
    }
    return {
      ok: true,
      plugin: {
        manifest,
        manifestPath,
        modulePath,
        exports: { render: exportsObj.render as PluginReporterExports['render'] },
      },
    };
  } catch (err) {
    const detail = describePluginModuleLoadError(
      err,
      manifest.module,
      modulePath,
      'reporter manifest',
    );
    return pluginRuntimeFail({
      code: 'reporter-load-error',
      message: `reporter plugin "${manifest.name}" failed to load: ${detail.message}`,
      hint: detail.hint ?? 'Check the reporter module path and module syntax.',
    });
  }
}

function untrustedReporterDiagnostic(name: string, status: PluginTrustStatus): PluginDiagnostic {
  const changed = status === 'changed';
  return {
    code: 'plugin-untrusted',
    message: changed
      ? `reporter plugin "${name}" changed since it was trusted; not executed`
      : `reporter plugin "${name}" is not trusted; not executed`,
    hint: `${changed ? 'Re-run' : 'Run'} \`projscan plugin trust ${name}\` to approve this reporter.`,
  };
}

function pluginRuntimeFail(
  diagnostic: PluginDiagnostic,
): PluginReporterResolveResult & PluginReporterRenderResult {
  return { ok: false, reason: diagnostic.message, diagnostic };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
