import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CodeGraph } from './codeGraph.js';
import type {
  FileEntry,
  Issue,
  DataflowReport,
  SemanticGraphReport,
} from '../types.js';
import { isWellShapedIssue } from './pluginIssueValidation.js';
import { getPluginTrustStatus, type PluginTrustStatus } from './pluginTrust.js';
import { validateManifest } from './pluginManifestValidation.js';
import type {
  PluginAnalyzerManifest,
  PluginDiagnostic,
  PluginManifest,
  PluginReporterCommand,
  PluginReporterManifest,
} from './pluginManifestValidation.js';

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
export const PLUGIN_DIR = '.projscan-plugins';
export const PLUGIN_MANIFEST_EXT = '.projscan-plugin.json';
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

type DynamicImport = (specifier: string) => Promise<Record<string, unknown>>;
// Keep arbitrary plugin file URLs out of Vite/Vitest's static import transform.
const dynamicImport = new Function('specifier', 'return import(specifier)') as DynamicImport;

export interface PluginAnalyzerContext {
  schemaVersion: 1;
  getCodeGraph: () => Promise<CodeGraph>;
  getSemanticGraph: () => Promise<SemanticGraphReport>;
  getDataflow: () => Promise<DataflowReport>;
}

export interface PluginAnalyzerExports {
  check: (
    rootPath: string,
    files: FileEntry[],
    context?: PluginAnalyzerContext,
  ) => Promise<Issue[]> | Issue[];
}

export interface PluginReporterContext<TPayload = unknown> {
  command: PluginReporterCommand;
  rootPath: string;
  manifest: PluginReporterManifest;
  payload: TPayload;
}

export interface PluginReporterExports {
  render: (context: PluginReporterContext) => Promise<string> | string;
}

export interface LoadedPlugin {
  manifest: PluginAnalyzerManifest;
  /** Absolute path to the manifest file on disk. */
  manifestPath: string;
  /** Absolute path to the resolved module entry point. */
  modulePath: string;
  exports: PluginAnalyzerExports;
}

export interface LoadedReporterPlugin {
  manifest: PluginReporterManifest;
  /** Absolute path to the manifest file on disk. */
  manifestPath: string;
  /** Absolute path to the resolved module entry point. */
  modulePath: string;
  exports: PluginReporterExports;
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

export type PluginReporterResolveResult =
  | { ok: true; plugin: LoadedReporterPlugin }
  | { ok: false; reason: string; diagnostic: PluginDiagnostic };

export type PluginReporterRenderResult =
  | { ok: true; output: string }
  | { ok: false; reason: string; diagnostic: PluginDiagnostic };

export function pluginsEnabled(): boolean {
  const v = process.env[PLUGIN_PREVIEW_FLAG];
  return v === '1' || v === 'true';
}

export async function readPluginManifestFile(
  manifestPath: string,
): Promise<PluginManifestFileResult> {
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
    if (entry.manifest.kind !== 'analyzer') continue;
    const modulePath = path.resolve(path.dirname(entry.manifestPath), entry.manifest.module);
    try {
      await assertPluginModuleReadable(entry.manifest.module, modulePath);
      // Trust-on-first-use gate: never import (execute) a module the user
      // hasn't explicitly approved. The preview flag opts a user into the
      // plugin *system*; trust opts them into each specific module's bytes.
      const trust = await getPluginTrustStatus(modulePath);
      if (trust.status !== 'trusted') {
        process.stderr.write(untrustedAnalyzerWarning(entry.manifest.name, trust.status));
        continue;
      }
      const mod = await importPluginModule(modulePath);
      const exportsObj = (mod.default ?? mod) as Partial<PluginAnalyzerExports>;
      if (typeof exportsObj.check !== 'function') {
        process.stderr.write(
          `[projscan] plugin "${entry.manifest.name}" missing required export "check"; export default { check(rootPath, files) { ... } } or export a named check function. skipped.\n`,
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
      const detail = describePluginModuleLoadError(
        err,
        entry.manifest.module,
        modulePath,
        'manifest',
      );
      process.stderr.write(
        `[projscan] plugin "${entry.manifest.name}" failed to load: ${detail.message}${detail.hint ? ` ${detail.hint}` : ''}. skipped.\n`,
      );
    }
  }
  return loaded;
}

export async function resolveReporterPlugin(
  rootPath: string,
  reporterName: string,
  command: PluginReporterCommand,
): Promise<PluginReporterResolveResult> {
  if (!pluginsEnabled()) {
    return pluginRuntimeFail({
      code: 'plugins-disabled',
      message: `reporter plugins require ${PLUGIN_PREVIEW_FLAG}=1`,
      hint: `Set ${PLUGIN_PREVIEW_FLAG}=1 in the environment to enable plugin reporters.`,
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

async function loadReporterPlugin(
  manifest: PluginReporterManifest,
  manifestPath: string,
): Promise<PluginReporterResolveResult> {
  const modulePath = path.resolve(path.dirname(manifestPath), manifest.module);
  try {
    await assertPluginModuleReadable(manifest.module, modulePath);
    // Trust-on-first-use gate — see loadPlugins. Reporters render to stdout,
    // but importing the module still runs its top-level code, so the same
    // approval requirement applies.
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

class PluginModuleMissingError extends Error {
  constructor(
    readonly manifestModule: string,
    readonly modulePath: string,
  ) {
    super(`module "${manifestModule}" was not found at ${modulePath}`);
  }
}

class PluginModuleReadError extends Error {
  constructor(
    readonly manifestModule: string,
    readonly modulePath: string,
    err: unknown,
  ) {
    super(`module "${manifestModule}" could not be read at ${modulePath}: ${formatError(err)}`);
  }
}

async function assertPluginModuleReadable(
  manifestModule: string,
  modulePath: string,
): Promise<void> {
  try {
    await fs.access(modulePath);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (code === 'ENOENT') throw new PluginModuleMissingError(manifestModule, modulePath);
    throw new PluginModuleReadError(manifestModule, modulePath, err);
  }
}

function describePluginModuleLoadError(
  err: unknown,
  manifestModule: string,
  modulePath: string,
  manifestLabel: 'manifest' | 'reporter manifest',
): { message: string; hint?: string } {
  if (err instanceof PluginModuleMissingError) {
    return {
      message: err.message,
      hint: `Check the ${manifestLabel} "module" path.`,
    };
  }
  if (err instanceof PluginModuleReadError) {
    return {
      message: err.message,
      hint: `Check file permissions for the ${manifestLabel} "module" path.`,
    };
  }
  if (err instanceof SyntaxError) {
    return {
      message: `syntax error in module "${manifestModule}": ${formatError(err)}`,
      hint: `Run node "${modulePath}" to reproduce the syntax error.`,
    };
  }
  return { message: formatError(err) };
}

function untrustedAnalyzerWarning(name: string, status: PluginTrustStatus): string {
  const reason =
    status === 'changed' ? 'module changed since it was trusted' : 'module is not trusted';
  const verb = status === 'changed' ? 'Re-run' : 'Run';
  return `[projscan] plugin "${name}" ${reason}; skipped (not executed). ${verb} \`projscan plugin trust ${name}\` to approve this module.\n`;
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

function importPluginModule(modulePath: string): Promise<Record<string, unknown>> {
  return dynamicImport(pathToFileURL(modulePath).href).catch(async (err) => {
    if (!isMissingDynamicImportCallback(err)) throw err;
    return importPluginModuleFromSource(modulePath);
  });
}

function isMissingDynamicImportCallback(err: unknown): boolean {
  return (
    err instanceof TypeError && err.message.includes('dynamic import callback was not specified')
  );
}

async function importPluginModuleFromSource(modulePath: string): Promise<Record<string, unknown>> {
  const source = await fs.readFile(modulePath, 'utf-8');
  const defaultMatch = source.match(/^\s*export\s+default\s+([\s\S]*?)\s*;?\s*$/);
  if (defaultMatch) {
    const expression = defaultMatch[1].trim().replace(/;$/, '');
    return { default: new Function(`return (${expression});`)() as unknown };
  }

  const names: string[] = [];
  let transformed = source.replace(
    /\bexport\s+(async\s+function|function)\s+([A-Za-z_$][\w$]*)/g,
    (_m, kind, name) => {
      names.push(String(name));
      return `${kind} ${name}`;
    },
  );
  transformed = transformed.replace(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=/g, (_m, name) => {
    names.push(String(name));
    return `const ${name} =`;
  });
  if (names.length === 0) {
    throw new Error('unsupported module syntax in Vitest VM fallback');
  }
  return new Function(`${transformed}\nreturn { ${names.join(', ')} };`)() as Record<
    string,
    unknown
  >;
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

function pluginRuntimeFail(
  diagnostic: PluginDiagnostic,
): PluginReporterResolveResult & PluginReporterRenderResult {
  return { ok: false, reason: diagnostic.message, diagnostic };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
