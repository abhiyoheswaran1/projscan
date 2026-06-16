import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue, IssueSeverity } from '../types.js';

type DependencyScope =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'peerDependencies';

interface PackageManifest {
  name?: string;
  version?: string;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
}

const DEPENDENCY_SCOPES: readonly DependencyScope[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const LIFECYCLE_SCRIPTS = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepublish',
  'prepublishOnly',
]);

const HIDDEN_HOOK_FILES = new Set([
  '.claude/settings.json',
  '.vscode/settings.json',
  '.vscode/tasks.json',
]);

const PAYLOAD_FILENAMES = new Set(['router_init.js', 'tanstack_runner.js']);
const MAX_JSON_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_LOCKFILE_BYTES = 25 * 1024 * 1024;
const MAX_JS_PAYLOAD_SCAN_BYTES = 5 * 1024 * 1024;
const LARGE_JS_PAYLOAD_BYTES = 1024 * 1024;

const GITHUB_COMMIT_REF = /#[0-9a-f]{7,40}$/i;

const KNOWN_CONTENT_IOCS: Array<{ value: string; label: string }> = [
  {
    value: 'github:tanstack/router#79ac49eedf774dd4b0cfa308722bc463cfe5885c',
    label: 'Mini Shai-Hulud malicious TanStack git dependency',
  },
  {
    value: '79ac49eedf774dd4b0cfa308722bc463cfe5885c',
    label: 'Mini Shai-Hulud malicious TanStack git ref',
  },
  { value: '@tanstack/setup', label: 'Mini Shai-Hulud fictitious package' },
  { value: 'git-tanstack.com', label: 'Mini Shai-Hulud lookalike domain' },
  { value: 'gh-token-monitor', label: 'GitHub token monitor persistence marker' },
  { value: 'filev2.getsession.org', label: 'Mini Shai-Hulud exfiltration network' },
  { value: 'seed1.getsession.org', label: 'Mini Shai-Hulud exfiltration network' },
  { value: 'seed2.getsession.org', label: 'Mini Shai-Hulud exfiltration network' },
  { value: 'seed3.getsession.org', label: 'Mini Shai-Hulud exfiltration network' },
  { value: 'litter.catbox.moe/h8nc9u.js', label: 'Mini Shai-Hulud second-stage payload URL' },
  { value: 'litter.catbox.moe/7rrc6l.mjs', label: 'Mini Shai-Hulud second-stage payload URL' },
];

const HIDDEN_HOOK_DANGER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /gh-token-monitor/i, label: 'GitHub token monitor persistence marker' },
  { pattern: /git-tanstack\.com/i, label: 'Mini Shai-Hulud lookalike domain' },
  { pattern: /router_init\.js/i, label: 'Mini Shai-Hulud payload filename' },
  { pattern: /rm\s+-rf\s+(?:~|\$HOME|\/)/i, label: 'destructive home/root delete command' },
  { pattern: /pkill\s+-f\s+gh-token-monitor/i, label: 'token-monitor process control' },
  { pattern: /curl\b.+\|\s*(?:sh|bash)/i, label: 'download-and-execute shell pipeline' },
];

const OBFUSCATION_MARKERS = [
  /while\s*\(\s*!!\[\]\s*\)/,
  /_0x[a-f0-9]{4,}/i,
  /String\s*\[\s*['"]fromCharCode['"]\s*\]/,
  /\bFunction\s*\(\s*['"]/,
  /\beval\s*\(/,
];

const MALICIOUS_PACKAGE_VERSIONS = new Map<string, Set<string>>(
  Object.entries({
    '@tanstack/arktype-adapter': ['1.166.12', '1.166.15'],
    '@tanstack/eslint-plugin-router': ['1.161.9', '1.161.12'],
    '@tanstack/eslint-plugin-start': ['0.0.4', '0.0.7'],
    '@tanstack/history': ['1.161.9', '1.161.12'],
    '@tanstack/nitro-v2-vite-plugin': ['1.154.12', '1.154.15'],
    '@tanstack/react-router': ['1.169.5', '1.169.8'],
    '@tanstack/react-router-devtools': ['1.166.16', '1.166.19'],
    '@tanstack/react-router-ssr-query': ['1.166.15', '1.166.18'],
    '@tanstack/react-start': ['1.167.68', '1.167.71'],
    '@tanstack/react-start-client': ['1.166.51', '1.166.54'],
    '@tanstack/react-start-rsc': ['0.0.47', '0.0.50'],
    '@tanstack/react-start-server': ['1.166.55', '1.166.58'],
    '@tanstack/router-cli': ['1.166.46', '1.166.49'],
    '@tanstack/router-core': ['1.169.5', '1.169.8'],
    '@tanstack/router-devtools': ['1.166.16', '1.166.19'],
    '@tanstack/router-devtools-core': ['1.167.6', '1.167.9'],
    '@tanstack/router-generator': ['1.166.45', '1.166.48'],
    '@tanstack/router-plugin': ['1.167.38', '1.167.41'],
    '@tanstack/router-ssr-query-core': ['1.168.3', '1.168.6'],
    '@tanstack/router-utils': ['1.161.11', '1.161.14'],
    '@tanstack/router-vite-plugin': ['1.166.53', '1.166.56'],
    '@tanstack/solid-router': ['1.169.5', '1.169.8'],
    '@tanstack/solid-router-devtools': ['1.166.16', '1.166.19'],
    '@tanstack/solid-router-ssr-query': ['1.166.15', '1.166.18'],
    '@tanstack/solid-start': ['1.167.65', '1.167.68'],
    '@tanstack/solid-start-client': ['1.166.50', '1.166.53'],
    '@tanstack/solid-start-server': ['1.166.54', '1.166.57'],
    '@tanstack/start-client-core': ['1.168.5', '1.168.8'],
    '@tanstack/start-fn-stubs': ['1.161.9', '1.161.12'],
    '@tanstack/start-plugin-core': ['1.169.23', '1.169.26'],
    '@tanstack/start-server-core': ['1.167.33', '1.167.36'],
    '@tanstack/start-static-server-functions': ['1.166.44', '1.166.47'],
    '@tanstack/start-storage-context': ['1.166.38', '1.166.41'],
    '@tanstack/valibot-adapter': ['1.166.12', '1.166.15'],
    '@tanstack/virtual-file-routes': ['1.161.10', '1.161.13'],
    '@tanstack/vue-router': ['1.169.5', '1.169.8'],
    '@tanstack/vue-router-devtools': ['1.166.16', '1.166.19'],
    '@tanstack/vue-router-ssr-query': ['1.166.15', '1.166.18'],
    '@tanstack/vue-start': ['1.167.61', '1.167.64'],
    '@tanstack/vue-start-client': ['1.166.46', '1.166.49'],
    '@tanstack/vue-start-server': ['1.166.50', '1.166.53'],
    '@tanstack/zod-adapter': ['1.166.12', '1.166.15'],
  }).map(([name, versions]) => [name, new Set(versions)]),
);

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const issues: Issue[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (isPackageManifest(file)) {
      await scanPackageManifest(file, issues, seen);
      continue;
    }
    if (isPackageLock(file)) {
      await scanPackageLock(file, issues, seen);
      continue;
    }
    if (HIDDEN_HOOK_FILES.has(normalizePath(file.relativePath))) {
      await scanHiddenHook(file, issues, seen);
      continue;
    }
    if (isJavaScriptPayloadCandidate(file)) {
      await scanJavaScriptPayload(file, issues, seen);
    }
  }

  return issues;
}

async function scanPackageManifest(
  file: FileEntry,
  issues: Issue[],
  seen: Set<string>,
): Promise<void> {
  const manifest = await readJson<PackageManifest>(file.absolutePath, MAX_JSON_MANIFEST_BYTES);
  if (!manifest) return;

  for (const scope of DEPENDENCY_SCOPES) {
    const deps = manifest[scope];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, rawSpec] of Object.entries(deps)) {
      const spec = typeof rawSpec === 'string' ? rawSpec.trim() : '';
      if (!spec) continue;
      const exactVersion = normalizeExactVersion(spec);
      if (exactVersion && isKnownMaliciousVersion(name, exactVersion)) {
        pushIssue(issues, seen, maliciousPackageIssue(name, exactVersion, file.relativePath));
      }
      const ioc = KNOWN_CONTENT_IOCS.find(({ value }) => spec.includes(value));
      if (ioc) {
        pushIssue(
          issues,
          seen,
          makeIssue({
            id: `supply-chain-known-ioc-${safeId(name)}`,
            title: `Known malicious dependency IOC: ${name}`,
            description: `${name} is declared as "${spec}", which matches ${ioc.label}. Remove the dependency, delete node_modules and lockfiles, reinstall from clean sources, and rotate secrets on any machine that installed it.`,
            severity: 'error',
            file: file.relativePath,
          }),
        );
      } else if (isGithubCommitDependency(spec)) {
        pushIssue(
          issues,
          seen,
          makeIssue({
            id: `supply-chain-git-dependency-${safeId(name)}`,
            title: `Dependency resolves directly to a GitHub commit: ${name}`,
            description: `The ${scope} entry "${name}" points at "${spec}". GitHub commit dependencies can bypass normal registry review and can run lifecycle scripts during install; pin a vetted registry package or remove the dependency.`,
            severity: 'warning',
            file: file.relativePath,
          }),
        );
      }
    }
  }

  if (manifest.scripts && typeof manifest.scripts === 'object') {
    for (const [scriptName, rawCommand] of Object.entries(manifest.scripts)) {
      if (!LIFECYCLE_SCRIPTS.has(scriptName)) continue;
      const command = typeof rawCommand === 'string' ? rawCommand : String(rawCommand);
      if (!shouldFlagLifecycleScript(scriptName, command)) continue;
      pushIssue(
        issues,
        seen,
        makeIssue({
          id: `supply-chain-lifecycle-${scriptName}`,
          title: `Install lifecycle script present: ${scriptName}`,
          description: `The package manifest defines "${scriptName}": "${command}". Install lifecycle scripts execute during dependency installation and are a common supply-chain execution path; verify this script before release or install.`,
          severity: 'warning',
          file: file.relativePath,
        }),
      );
    }
  }
}

async function scanPackageLock(file: FileEntry, issues: Issue[], seen: Set<string>): Promise<void> {
  const lock = await readJson<{
    packages?: Record<
      string,
      {
        version?: unknown;
        resolved?: unknown;
        dependencies?: Record<string, unknown>;
        optionalDependencies?: Record<string, unknown>;
      }
    >;
    dependencies?: Record<string, { version?: unknown; resolved?: unknown }>;
  }>(file.absolutePath, MAX_LOCKFILE_BYTES);
  if (!lock) return;

  for (const [entryPath, entry] of Object.entries(lock.packages ?? {})) {
    const name = packageNameFromLockPath(entryPath);
    const version = typeof entry.version === 'string' ? entry.version : null;
    if (name && version && isKnownMaliciousVersion(name, version)) {
      pushIssue(issues, seen, maliciousPackageIssue(name, version, file.relativePath));
    }
    const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
    const resolvedIoc = KNOWN_CONTENT_IOCS.find(({ value }) => resolved.includes(value));
    if (resolvedIoc) {
      pushIssue(
        issues,
        seen,
        makeIssue({
          id: `supply-chain-known-ioc-${safeId(name ?? entryPath)}`,
          title: `Known malicious lockfile IOC: ${name ?? entryPath}`,
          description: `The lockfile package entry resolves through ${resolvedIoc.label}. Remove the dependency, delete node_modules and lockfiles, reinstall from clean sources, and rotate secrets on any machine that installed it.`,
          severity: 'error',
          file: file.relativePath,
        }),
      );
    }
    const manifestDeps = { ...(entry.dependencies ?? {}), ...(entry.optionalDependencies ?? {}) };
    for (const [depName, rawSpec] of Object.entries(manifestDeps)) {
      const spec = typeof rawSpec === 'string' ? rawSpec : '';
      const ioc = KNOWN_CONTENT_IOCS.find(
        ({ value }) => spec.includes(value) || resolved.includes(value),
      );
      if (!ioc) continue;
      pushIssue(
        issues,
        seen,
        makeIssue({
          id: `supply-chain-known-ioc-${safeId(depName)}`,
          title: `Known malicious lockfile IOC: ${depName}`,
          description: `The lockfile contains ${ioc.label}. Remove the dependency, delete node_modules and lockfiles, reinstall from clean sources, and rotate secrets on any machine that installed it.`,
          severity: 'error',
          file: file.relativePath,
        }),
      );
    }
  }

  for (const [name, entry] of Object.entries(lock.dependencies ?? {})) {
    const version = typeof entry.version === 'string' ? entry.version : null;
    if (version && isKnownMaliciousVersion(name, version)) {
      pushIssue(issues, seen, maliciousPackageIssue(name, version, file.relativePath));
    }
    const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
    const resolvedIoc = KNOWN_CONTENT_IOCS.find(({ value }) => resolved.includes(value));
    if (resolvedIoc) {
      pushIssue(
        issues,
        seen,
        makeIssue({
          id: `supply-chain-known-ioc-${safeId(name)}`,
          title: `Known malicious lockfile IOC: ${name}`,
          description: `The lockfile dependency resolves through ${resolvedIoc.label}. Remove the dependency, delete node_modules and lockfiles, reinstall from clean sources, and rotate secrets on any machine that installed it.`,
          severity: 'error',
          file: file.relativePath,
        }),
      );
    }
  }
}

async function scanHiddenHook(file: FileEntry, issues: Issue[], seen: Set<string>): Promise<void> {
  const content = await readText(file.absolutePath, 256 * 1024);
  if (!content) return;

  const matched = HIDDEN_HOOK_DANGER_PATTERNS.find(({ pattern }) => pattern.test(content));
  if (!matched) return;

  pushIssue(
    issues,
    seen,
    makeIssue({
      id: 'supply-chain-hidden-persistence-hook',
      title: `Hidden editor/agent persistence hook in ${file.relativePath}`,
      description: `${file.relativePath} contains ${matched.label}. Treat this as possible supply-chain persistence: remove the hook, inspect running processes, and rotate credentials if it may have executed.`,
      severity: 'error',
      file: file.relativePath,
    }),
  );
}

async function scanJavaScriptPayload(
  file: FileEntry,
  issues: Issue[],
  seen: Set<string>,
): Promise<void> {
  const basename = path.basename(file.relativePath);
  if (PAYLOAD_FILENAMES.has(basename)) {
    pushIssue(
      issues,
      seen,
      makeIssue({
        id: `supply-chain-payload-file-${safeId(basename)}`,
        title: `Known malicious payload filename: ${basename}`,
        description: `${basename} matches a known Mini Shai-Hulud payload/helper filename. Remove the file, inspect install artifacts, and rotate credentials on any machine where it may have run.`,
        severity: 'error',
        file: file.relativePath,
      }),
    );
    return;
  }

  if (file.sizeBytes < LARGE_JS_PAYLOAD_BYTES || file.sizeBytes > MAX_JS_PAYLOAD_SCAN_BYTES) return;
  const content = await readText(file.absolutePath, MAX_JS_PAYLOAD_SCAN_BYTES);
  if (!content) return;

  const ioc = KNOWN_CONTENT_IOCS.find(({ value }) => content.includes(value));
  if (ioc) {
    pushIssue(
      issues,
      seen,
      makeIssue({
        id: `supply-chain-known-ioc-${safeId(basename)}`,
        title: `Known malicious JavaScript IOC in ${file.relativePath}`,
        description: `${file.relativePath} contains ${ioc.label}. Remove the artifact and rotate credentials on any machine where it may have run.`,
        severity: 'error',
        file: file.relativePath,
      }),
    );
    return;
  }

  const markerCount = OBFUSCATION_MARKERS.filter((pattern) => pattern.test(content)).length;
  const hasLongLine = content.split(/\r?\n/, 4).some((line) => line.length > 50_000);
  if (markerCount >= 2 || (markerCount >= 1 && hasLongLine)) {
    pushIssue(
      issues,
      seen,
      makeIssue({
        id: `supply-chain-obfuscated-payload-${safeId(basename)}`,
        title: `Large obfuscated JavaScript payload: ${file.relativePath}`,
        description: `${file.relativePath} is over 1 MB and contains obfuscation markers often seen in install-time malware. Inspect the artifact before installing or publishing.`,
        severity: 'warning',
        file: file.relativePath,
      }),
    );
  }
}

function maliciousPackageIssue(name: string, version: string, file: string): Issue {
  return makeIssue({
    id: `supply-chain-malicious-package-${name}`,
    title: `Known malicious package version: ${name}@${version}`,
    description: `${name}@${version} is listed in the May 11, 2026 TanStack Mini Shai-Hulud advisory. Remove the version from manifests/lockfiles, reinstall from a clean lockfile, and rotate credentials on any machine or CI runner that installed it.`,
    severity: 'error',
    file,
  });
}

function makeIssue(input: {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  file: string;
}): Issue {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    severity: input.severity,
    category: 'supply-chain',
    fixAvailable: false,
    locations: [{ file: input.file, line: 1 }],
  };
}

function pushIssue(issues: Issue[], seen: Set<string>, issue: Issue): void {
  const file = issue.locations?.[0]?.file ?? '';
  const key = `${issue.id}:${file}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push(issue);
}

function isKnownMaliciousVersion(name: string, version: string): boolean {
  return MALICIOUS_PACKAGE_VERSIONS.get(name)?.has(version) === true;
}

function shouldFlagLifecycleScript(scriptName: string, command: string): boolean {
  if (scriptName !== 'prepare') return true;
  return (
    /\b(?:bun|node|deno|python|ruby|bash|sh|curl|wget|powershell|pwsh|npx)\b/i.test(command) ||
    /\b(?:npm\s+exec|pnpm\s+dlx|yarn\s+dlx)\b/i.test(command) ||
    /(?:&&|\|\||\|)/.test(command)
  );
}

function normalizeExactVersion(spec: string): string | null {
  const trimmed = spec.trim();
  if (/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(trimmed)) return trimmed;
  return null;
}

function isGithubCommitDependency(spec: string): boolean {
  if (!GITHUB_COMMIT_REF.test(spec)) return false;
  const withoutRef = spec.slice(0, spec.lastIndexOf('#'));
  return (
    /^(?:github:)?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(withoutRef) ||
    /^(?:git\+https|https|git):\/\/github\.com\/.+/i.test(withoutRef) ||
    /^(?:git\+ssh|ssh):\/\/git@github\.com[:/].+/i.test(withoutRef) ||
    /^git@github\.com:.+/i.test(withoutRef)
  );
}

function isPackageManifest(file: FileEntry): boolean {
  return (
    path.basename(file.relativePath) === 'package.json' &&
    !normalizePath(file.relativePath).includes('/node_modules/')
  );
}

function isPackageLock(file: FileEntry): boolean {
  return path.basename(file.relativePath) === 'package-lock.json';
}

function isJavaScriptPayloadCandidate(file: FileEntry): boolean {
  const basename = path.basename(file.relativePath);
  return PAYLOAD_FILENAMES.has(basename) || ['.js', '.mjs', '.cjs'].includes(file.extension);
}

function packageNameFromLockPath(entryPath: string): string | null {
  const marker = 'node_modules/';
  const markerIndex = entryPath.lastIndexOf(marker);
  if (markerIndex === -1) return null;
  const last = entryPath.slice(markerIndex + marker.length);
  if (!last) return null;
  const segments = last.split('/');
  if (segments[0]?.startsWith('@') && segments[1]) return `${segments[0]}/${segments[1]}`;
  return segments[0] || null;
}

function safeId(value: string): string {
  return value
    .replace(/^@/, '')
    .replace(/[^A-Za-z0-9._/-]+/g, '-')
    .replace(/\/+/g, '-');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

async function readJson<T>(filePath: string, maxBytes: number): Promise<T | null> {
  const content = await readText(filePath, maxBytes);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readText(filePath: string, maxBytes: number): Promise<string | null> {
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}
