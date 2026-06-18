import path from 'node:path';
import type { LoadedPlugin, PluginAnalyzerExports } from './pluginRuntimeTypes.js';
import {
  assertPluginModuleReadable,
  describePluginModuleLoadError,
  importPluginModule,
} from './pluginModuleLoading.js';
import type { PluginDiscoveryEntry } from './pluginManifestDiscovery.js';
import type { PluginAnalyzerManifest } from './pluginManifestValidation.js';
import { getPluginTrustStatus, type PluginTrustStatus } from './pluginTrust.js';

export async function loadAnalyzerPluginEntry(
  entry: PluginDiscoveryEntry,
): Promise<LoadedPlugin | null> {
  const manifest = analyzerManifest(entry);
  if (!manifest) return null;
  const modulePath = path.resolve(path.dirname(entry.manifestPath), manifest.module);
  try {
    return await loadTrustedAnalyzerPlugin(entry.manifestPath, manifest, modulePath);
  } catch (err) {
    const detail = describePluginModuleLoadError(err, manifest.module, modulePath, 'manifest');
    process.stderr.write(
      `[projscan] plugin "${manifest.name}" failed to load: ${detail.message}${detail.hint ? ` ${detail.hint}` : ''}. skipped.\n`,
    );
    return null;
  }
}

async function loadTrustedAnalyzerPlugin(
  manifestPath: string,
  manifest: PluginAnalyzerManifest,
  modulePath: string,
): Promise<LoadedPlugin | null> {
  await assertPluginModuleReadable(manifest.module, modulePath);
  const exports = await loadTrustedAnalyzerExports(manifest.name, modulePath);
  if (!exports) return null;
  return {
    manifest,
    manifestPath,
    modulePath,
    exports,
  };
}

async function loadTrustedAnalyzerExports(
  name: string,
  modulePath: string,
): Promise<PluginAnalyzerExports | null> {
  const trust = await getPluginTrustStatus(modulePath);
  if (trust.status !== 'trusted') {
    process.stderr.write(untrustedAnalyzerWarning(name, trust.status));
    return null;
  }
  const mod = await importPluginModule(modulePath);
  const exportsObj = (mod.default ?? mod) as Partial<PluginAnalyzerExports>;
  if (typeof exportsObj.check !== 'function') {
    process.stderr.write(missingCheckWarning(name));
    return null;
  }
  return { check: exportsObj.check as PluginAnalyzerExports['check'] };
}

function analyzerManifest(entry: PluginDiscoveryEntry): PluginAnalyzerManifest | null {
  return entry.manifest?.kind === 'analyzer' ? entry.manifest : null;
}

function missingCheckWarning(name: string): string {
  return `[projscan] plugin "${name}" missing required export "check"; export default { check(rootPath, files) { ... } } or export a named check function. skipped.\n`;
}

function untrustedAnalyzerWarning(name: string, status: PluginTrustStatus): string {
  const reason =
    status === 'changed' ? 'module changed since it was trusted' : 'module is not trusted';
  const verb = status === 'changed' ? 'Re-run' : 'Run';
  return `[projscan] plugin "${name}" ${reason}; skipped (not executed). ${verb} \`projscan plugin trust ${name}\` to approve this module.\n`;
}
