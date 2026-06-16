export type SemverDrift = 'patch' | 'minor' | 'major' | 'same' | 'unknown';

export interface OutdatedPackage {
  name: string;
  declared: string;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  scope: 'dependency' | 'devDependency';
  /** Workspace package this dep was declared in. Empty/undefined when not a monorepo. */
  workspace?: string;
}

export interface OutdatedReport {
  available: boolean;
  reason?: string;
  totalPackages: number;
  packages: OutdatedPackage[];
  /** Per-workspace breakdown when scanning a monorepo. Empty for single-package repos. */
  byWorkspace?: Array<{ workspace: string; relativePath: string; total: number }>;
}

export type AuditSeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

export interface AuditFinding {
  name: string;
  severity: AuditSeverity;
  title: string;
  url?: string;
  cve?: string[];
  via: string[];
  range?: string;
  fixAvailable: boolean;
}

export interface AuditReport {
  available: boolean;
  reason?: string;
  summary: Record<AuditSeverity, number>;
  findings: AuditFinding[];
}

export interface UpgradePreview {
  available: boolean;
  reason?: string;
  name: string;
  /** Package ecosystem used for this preview. Absent on older/npm-only callers. */
  ecosystem?: 'npm' | 'python';
  declared: string | null;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  breakingMarkers: string[];
  changelogExcerpt?: string;
  importers: string[];
  /** Manifest file that declared the dependency, when known. */
  declaredSource?: string;
  /** 1-based line in the manifest that declared the dependency, when known. */
  declaredLine?: number;
  /** Manifest scope for the dependency, when known. */
  declaredScope?: 'dependency' | 'devDependency' | 'peerDependency' | 'main' | 'dev';
  /** Lockfile or pinned requirements file that supplied the installed/current version, when known. */
  installedSource?: string;
  /** 1-based line in installedSource that supplied the installed/current version, when known. */
  installedLine?: number;
  /**
   * 1.3+ — set when `previewUpgrade` was called with `checkRegistry: true`.
   * "registry" if the latest came from npm; "installed" if we fell back to
   * the locally-installed version (either offline mode or a registry fetch
   * that failed). Absent when no registry attempt was made.
   */
  latestSource?: 'registry' | 'installed';
  /** 1.3+ — set when a registry fetch was attempted and failed. */
  registryError?: string;
}
