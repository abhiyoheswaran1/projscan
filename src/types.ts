// === Scanning Results ===

export interface ScanResult {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  files: FileEntry[];
  directoryTree: DirectoryNode;
  scanDurationMs: number;
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

// === Language Detection ===

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

// === Framework Detection ===

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

// === Dependency Analysis ===

export interface DependencyReport {
  totalDependencies: number;
  totalDevDependencies: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  risks: DependencyRisk[];
}

export interface DependencyRisk {
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

// === Issues / Health ===

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface IssueLocation {
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: string;
  fixAvailable: boolean;
  fixId?: string;
  locations?: IssueLocation[];
}

// === Fix System ===

export interface Fix {
  id: string;
  title: string;
  description: string;
  issueId: string;
  apply: (rootPath: string) => Promise<void>;
}

export interface FixResult {
  fix: Fix;
  success: boolean;
  error?: string;
}

// === File Explanation ===

export interface FileExplanation {
  filePath: string;
  purpose: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  potentialIssues: string[];
  lineCount: number;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isRelative: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'default' | 'unknown';
}

// === Diagram ===

export interface ArchitectureLayer {
  name: string;
  technologies: string[];
  directories: string[];
}

// === Full Analysis Report ===

export interface AnalysisReport {
  projectName: string;
  rootPath: string;
  scan: ScanResult;
  languages: LanguageBreakdown;
  frameworks: FrameworkResult;
  dependencies: DependencyReport | null;
  issues: Issue[];
  timestamp: string;
}

// === Health Score ===

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  errors: number;
  warnings: number;
  infos: number;
}

// === Baseline / Diff ===

export interface BaselineHotspot {
  relativePath: string;
  riskScore: number;
  churn: number;
}

export interface Baseline {
  score: number;
  grade: HealthScore['grade'];
  issues: { id: string; title: string; severity: IssueSeverity }[];
  hotspots?: BaselineHotspot[];
  timestamp: string;
}

export interface HotspotDelta {
  relativePath: string;
  beforeScore: number | null;
  afterScore: number | null;
  scoreDelta: number;
}

export interface HotspotDiffSummary {
  rose: HotspotDelta[];
  fell: HotspotDelta[];
  appeared: HotspotDelta[];
  resolved: HotspotDelta[];
}

export interface DiffResult {
  before: Baseline;
  after: Baseline;
  scoreDelta: number;
  newIssues: string[];
  resolvedIssues: string[];
  hotspotDiff?: HotspotDiffSummary;
}

// === Reporter Interface ===

export type ReportFormat = 'console' | 'json' | 'markdown' | 'sarif';

// === Dependency Health (0.4.0) ===

export type SemverDrift = 'patch' | 'minor' | 'major' | 'same' | 'unknown';

export interface OutdatedPackage {
  name: string;
  declared: string;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  scope: 'dependency' | 'devDependency';
}

export interface OutdatedReport {
  available: boolean;
  reason?: string;
  totalPackages: number;
  packages: OutdatedPackage[];
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
  declared: string | null;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  breakingMarkers: string[];
  changelogExcerpt?: string;
  importers: string[];
}

// === Coverage (0.5.0) ===

export type CoverageSource = 'lcov' | 'coverage-final' | 'coverage-summary';

export interface FileCoverage {
  relativePath: string;
  lineCoverage: number;
  linesFound: number;
  linesHit: number;
}

export interface CoverageReport {
  available: boolean;
  reason?: string;
  source: CoverageSource | null;
  sourceFile: string | null;
  totalCoverage: number;
  files: FileCoverage[];
}

export interface CoverageJoinedHotspot {
  relativePath: string;
  riskScore: number;
  churn: number;
  lineCount: number;
  issueCount: number;
  coverage: number | null;
  priority: number;
  reasons: string[];
}

export interface CoverageJoinedReport {
  available: boolean;
  reason?: string;
  coverageSource: CoverageSource | null;
  coverageSourceFile: string | null;
  entries: CoverageJoinedHotspot[];
}

// === Config (.projscanrc) ===

export interface ProjscanConfig {
  minScore?: number;
  baseRef?: string;
  hotspots?: {
    limit?: number;
    since?: string;
  };
  ignore?: string[];
  disableRules?: string[];
  severityOverrides?: Record<string, IssueSeverity>;
}

export interface LoadedConfig {
  config: ProjscanConfig;
  source: string | null;
}

// === Hotspots ===

export interface AuthorShare {
  author: string;
  commits: number;
  share: number;
}

export interface FileHotspot {
  relativePath: string;
  churn: number;
  distinctAuthors: number;
  daysSinceLastChange: number | null;
  lineCount: number;
  /** AST-derived McCabe complexity. null when no language adapter parsed this file. */
  cyclomaticComplexity: number | null;
  sizeBytes: number;
  issueCount: number;
  issueIds: string[];
  riskScore: number;
  reasons: string[];
  primaryAuthor: string | null;
  primaryAuthorShare: number;
  busFactorOne: boolean;
  topAuthors: AuthorShare[];
  coverage?: number | null;
}

export interface HotspotReport {
  available: boolean;
  reason?: string;
  window: { since: string | null; commitsScanned: number };
  hotspots: FileHotspot[];
  totalFilesRanked: number;
}

// === Coupling + Cycles (0.11) ===

export interface FileCoupling {
  relativePath: string;
  /** Number of files that import this one. */
  fanIn: number;
  /** Number of locally-resolved imports this file makes. */
  fanOut: number;
  /** Bob Martin's instability: fanOut / (fanIn + fanOut). 0 when both are zero. */
  instability: number;
}

export interface ImportCycle {
  /** Member files of a strongly-connected component (size >= 2). */
  files: string[];
  size: number;
}

export interface CouplingReport {
  files: FileCoupling[];
  cycles: ImportCycle[];
  totalFiles: number;
  totalCycles: number;
}

// === PR-Native AST Diff (0.12) ===

export interface FileAstDiff {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  exportsAdded: string[];
  exportsRemoved: string[];
  importsAdded: string[];
  importsRemoved: string[];
  callsAdded: string[];
  callsRemoved: string[];
  /** CC(head) - CC(base). null when either side wasn't AST-parsed. */
  cyclomaticDelta: number | null;
  /** fanIn(head) - fanIn(base). null when graph entry missing on either side. */
  fanInDelta: number | null;
}

export interface PrDiffReport {
  available: boolean;
  reason?: string;
  base: { ref: string; resolvedSha: string | null };
  head: { ref: string; resolvedSha: string | null };
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: FileAstDiff[];
  totalFilesChanged: number;
}

// === Per-file Inspection ===

export interface FileInspection {
  relativePath: string;
  exists: boolean;
  reason?: string;
  purpose: string;
  lineCount: number;
  sizeBytes: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  potentialIssues: string[];
  hotspot: FileHotspot | null;
  issues: Issue[];
  /** AST-derived McCabe complexity. null when no language adapter parsed this file. */
  cyclomaticComplexity?: number | null;
  /** Number of files that import this one. null when graph unavailable. */
  fanIn?: number | null;
  /** Number of locally-resolved imports this file makes. null when graph unavailable. */
  fanOut?: number | null;
  /** Adapter id (e.g. 'javascript', 'python'). Set when the graph was available. */
  language?: string;
}

// === MCP ===

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
