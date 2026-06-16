export interface ScanResult {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  files: FileEntry[];
  directoryTree: DirectoryNode;
  scanDurationMs: number;
  scanBoundary: ScanBoundary;
}

export interface ScanBoundary {
  source: 'git' | 'glob';
  gitignoreRespected: boolean;
  includeIgnored: boolean;
  ignoredFileCount: number;
}

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  directory: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
  fileCount: number;
  totalFileCount: number;
}

export interface LanguageBreakdown {
  primary: string;
  languages: Record<string, LanguageStat>;
}

export interface LanguageStat {
  name: string;
  fileCount: number;
  percentage: number;
  extensions: string[];
}

export interface FrameworkResult {
  frameworks: DetectedFramework[];
  buildTools: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
}

export interface DetectedFramework {
  name: string;
  version?: string;
  category: 'frontend' | 'backend' | 'testing' | 'bundler' | 'css' | 'other';
  confidence: 'high' | 'medium' | 'low';
}

export interface DependencyReport {
  totalDependencies: number;
  totalDevDependencies: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  risks: DependencyRisk[];
  licenses?: DependencyLicenseSummary;
  sizes?: DependencySizeSummary;
  /**
   * Per-workspace breakdown when scanning a monorepo (0.13.0+). Absent for
   * single-package repos. The top-level `totalDependencies`,
   * `totalDevDependencies`, `dependencies`, `devDependencies`, and `risks`
   * fields aggregate across all workspaces (root manifest + each package).
   * For per-package detail, read this array.
   */
  byWorkspace?: Array<{
    workspace: string;
    relativePath: string;
    isRoot: boolean;
    totalDependencies: number;
    totalDevDependencies: number;
    risks: DependencyRisk[];
  }>;
}

export interface DependencyLicenseEntry {
  name: string;
  version: string;
  scope: 'production' | 'development';
  license: string | null;
  workspace?: string;
}

export interface DependencyLicenseSummary {
  packages: DependencyLicenseEntry[];
  byLicense: Record<string, number>;
  unknown: string[];
  copyleft: DependencyLicenseEntry[];
  noticeCandidates: DependencyLicenseEntry[];
}

export interface DependencySizeEntry {
  name: string;
  version: string;
  scope: 'production' | 'development';
  bytes: number | null;
  formatted: string;
  installed: boolean;
  workspace?: string;
}

export interface DependencySizeSummary {
  packages: DependencySizeEntry[];
  largest: DependencySizeEntry[];
  totalBytes: number;
  formattedTotal: string;
  missing: string[];
}

export interface DependencyRisk {
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  /** Workspace package name when found in a monorepo workspace manifest. Absent for the root. */
  workspace?: string;
}
