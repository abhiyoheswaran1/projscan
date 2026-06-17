import type { FileEntry, UpgradePreview } from '../types.js';
import { drift as semverDrift } from '../utils/semver.js';
import { buildImportGraph, filesImporting } from './importGraph.js';
import { OFFLINE_ENV, isOfflineMode } from './privacy.js';
import {
  isValidPackageName,
  readDeclaredVersion,
  readInstalledVersion,
  readNpmChangelogEvidence,
} from './upgradePreviewNpmEvidence.js';
import { previewPythonUpgrade } from './upgradePreviewPython.js';

export { isValidPackageName } from './upgradePreviewNpmEvidence.js';

export interface PreviewUpgradeOptions {
  /**
   * 1.3+ — when true, fetch the actual latest version from the npm
   * registry. Default false; the offline path uses `installed` as a
   * stand-in for `latest`. Behind an explicit flag because every other
   * code path in projscan is offline and we want that posture preserved
   * by default.
   */
  checkRegistry?: boolean;
  /** Registry URL override — defaults to https://registry.npmjs.org. */
  registryUrl?: string;
  /** Network timeout in ms. Default 5000. */
  fetchTimeoutMs?: number;
}

export async function previewUpgrade(
  rootPath: string,
  pkgName: string,
  files: FileEntry[],
  options: PreviewUpgradeOptions = {},
): Promise<UpgradePreview> {
  if (!isValidPackageName(pkgName)) {
    return {
      available: false,
      reason: `Invalid package name: "${pkgName}". Must match the npm package-name grammar.`,
      name: pkgName,
      declared: null,
      installed: null,
      latest: null,
      drift: 'unknown',
      breakingMarkers: [],
      importers: [],
    };
  }

  const declaredVersions = await readDeclaredVersion(rootPath, pkgName);
  const installed = await readInstalledVersion(rootPath, pkgName);
  // Offline default: `latest = installed`. With --check-registry, hit npm
  // and replace with the registry's view.
  let latest = installed;
  let registryError: string | undefined;
  if (options.checkRegistry) {
    if (isOfflineMode()) {
      registryError = `${OFFLINE_ENV} is enabled - registry network access is blocked`;
    } else {
      const fetched = await fetchLatestFromRegistry(pkgName, options);
      if (fetched.ok) {
        latest = fetched.version;
      } else {
        registryError = fetched.error;
      }
    }
  }

  if (!declaredVersions && !installed) {
    const pythonPreview = await previewPythonUpgrade(rootPath, pkgName, files);
    if (pythonPreview) return pythonPreview;

    return {
      available: false,
      reason: `Package "${pkgName}" not found in package.json or node_modules`,
      name: pkgName,
      declared: null,
      installed: null,
      latest: null,
      drift: 'unknown',
      breakingMarkers: [],
      importers: [],
    };
  }

  if (!installed) {
    const pythonPreview = await previewPythonUpgrade(rootPath, pkgName, files);
    if (pythonPreview?.available) return pythonPreview;

    return {
      available: false,
      reason: `Package "${pkgName}" not installed - run npm install and retry`,
      name: pkgName,
      declared: declaredVersions,
      installed: null,
      latest: null,
      drift: 'unknown',
      breakingMarkers: [],
      importers: [],
    };
  }

  const drift = semverDrift(declaredVersions, installed);

  const { breakingMarkers, changelogExcerpt } = await readNpmChangelogEvidence(
    rootPath,
    pkgName,
    declaredVersions,
    installed,
  );

  const graph = await buildImportGraph(rootPath, files);
  const importers = filesImporting(graph, pkgName);

  const latestSource: 'registry' | 'installed' | undefined = options.checkRegistry
    ? registryError
      ? 'installed'
      : 'registry'
    : undefined;

  return {
    available: true,
    name: pkgName,
    declared: declaredVersions,
    installed,
    latest,
    drift,
    breakingMarkers,
    changelogExcerpt,
    importers,
    ...(latestSource ? { latestSource } : {}),
    ...(registryError ? { registryError } : {}),
  };
}

/**
 * Fetch the latest version of `pkgName` from the npm registry. Uses
 * Node's built-in fetch (Node 18+). Network-only; the caller must have
 * opted in via `checkRegistry: true`.
 *
 * Returns `{ ok: true, version }` on success or `{ ok: false, error }` on
 * timeout / non-2xx / network error. Failures are non-fatal — the offline
 * `latest = installed` fallback still produces a valid preview.
 */
async function fetchLatestFromRegistry(
  pkgName: string,
  options: PreviewUpgradeOptions,
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  const registry = (options.registryUrl ?? 'https://registry.npmjs.org').replace(/\/+$/, '');
  // npm encodes the scope's `/` as `%2F` for the abbreviated metadata path.
  const encoded = pkgName.startsWith('@') ? pkgName.replace('/', '%2F') : pkgName;
  const url = `${registry}/${encoded}/latest`;
  const timeoutMs = options.fetchTimeoutMs ?? 5000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, error: `registry returned HTTP ${res.status}` };
    }
    const body = (await res.json()) as { version?: unknown };
    if (typeof body.version !== 'string') {
      return { ok: false, error: 'registry response missing "version" field' };
    }
    return { ok: true, version: body.version };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `registry fetch failed: ${msg.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}
