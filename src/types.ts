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

export interface DependencyRisk {
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  /** Workspace package name when found in a monorepo workspace manifest. Absent for the root. */
  workspace?: string;
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
  /**
   * One-line hint shown inline in projscan_doctor output (0.14.0+). Points
   * at the fix-suggest pipeline. Absent when no template matches the issue.
   */
  suggestedAction?: { summary: string };
}

// === Fix Suggest (0.14) ===

/**
 * Structured action prompt the agent can paste into its plan. Returned by
 * projscan_fix_suggest. projscan does not run an LLM - this is rule-driven
 * guidance with the issue, the location, and a one-paragraph instruction
 * the agent (LLM) is expected to act on.
 */
export interface FixSuggestion {
  /** Echoes the input issue id when matched. */
  issueId: string;
  /** Severity level passed through from the source issue. */
  severity: IssueSeverity;
  /** Issue category passed through. */
  category: string;
  /** One-line "what is wrong". */
  headline: string;
  /** 2-4 sentences of why this matters. Severity-anchored. */
  why: string;
  /** Affected locations (mirrors Issue.locations when known). */
  where: IssueLocation[];
  /** One-paragraph instruction for the driving agent. */
  instruction: string;
  /** Optional "verify the fix by..." note. */
  suggestedTest?: string;
  /** Optional related files (importers, peer rules) for context. */
  relatedFiles?: string[];
  /** Optional documentation links. */
  references?: string[];
}

/**
 * Markdown-rendered deep dive for a single issue. Returned by
 * projscan_explain_issue. Includes the surrounding code excerpt and any
 * git-log evidence of similar fixes already merged in this repo.
 */
export interface IssueExplanation {
  issueId: string;
  title: string;
  severity: IssueSeverity;
  category: string;
  headline: string;
  /** Source-code excerpt around the primary location. Empty when no location. */
  excerpt: { file: string; startLine: number; endLine: number; lines: string[] } | null;
  /** Other open issues touching the same file (id + title pairs). */
  relatedIssues: Array<{ id: string; title: string }>;
  /**
   * Git log references where this issue id (or its rule prefix) appears in a
   * commit message - hints at how teammates have addressed it before.
   * Empty when none found or git history unavailable.
   */
  similarFixes: Array<{ sha: string; subject: string; date: string }>;
  /** The full FixSuggestion if a template matched; null otherwise. */
  fix: FixSuggestion | null;
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

export type ReportFormat = 'console' | 'json' | 'markdown' | 'sarif' | 'html';

// === Dependency Health (0.4.0) ===

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
  declared: string | null;
  installed: string | null;
  latest: string | null;
  drift: SemverDrift;
  breakingMarkers: string[];
  changelogExcerpt?: string;
  importers: string[];
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
  /**
   * Monorepo-specific configuration (0.14.0+). Currently scopes the
   * cross-package import policy: each entry says "package P may only import
   * from these listed packages, or specifically may NOT import from these
   * listed packages." Edges that violate become `cross-package-violation-*`
   * issues in projscan_doctor.
   */
  monorepo?: {
    importPolicy?: ImportPolicyRule[];
  };
  /**
   * Taint analysis tuning (1.6.0+). Both lists merge ON TOP of the
   * built-in defaults — they don't replace them. Use this to add
   * project-specific source/sink names: `customSecretReader`, `query`,
   * `runRawSql`, etc. To suppress a default, list the rule id under
   * `disableRules` (e.g. `taint-flow-detected`).
   */
  taint?: {
    sources?: string[];
    sinks?: string[];
  };
}

/**
 * One cross-package import rule. `from` is the package name (matches
 * WorkspacePackage.name). Exactly one of `allow` / `deny` is required. Both
 * lists are package-name globs - a leading `!` negates a single entry, and a
 * single `*` is the wildcard. When both `allow` and `deny` are set, allow
 * is checked first and a hit short-circuits as ALLOWED; otherwise deny is
 * checked.
 */
export interface ImportPolicyRule {
  from: string;
  allow?: string[];
  deny?: string[];
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
  /**
   * 1.5+ — true when Project Memory has marked this file as
   * "accepted load-bearing debt" (top-K hotspot for ≥ 5 runs over
   * ≥ 7 days without CC/churn improving). The reporter tags accepted
   * rows so users aren't repeatedly pestered about debt they've
   * implicitly opted into. Absent on older saves / fresh runs.
   */
  accepted?: boolean;
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

export interface CrossPackageEdge {
  /** Importing file + the workspace package it belongs to. */
  from: { file: string; package: string };
  /** Imported file + the workspace package it belongs to. */
  to: { file: string; package: string };
}

export interface CouplingReport {
  files: FileCoupling[];
  cycles: ImportCycle[];
  /**
   * Edges where importer and imported live in different workspace packages
   * (0.11). Empty when no workspace info was supplied or when all edges are
   * intra-package. Useful for spotting unauthorized deep imports across
   * package boundaries.
   */
  crossPackageEdges: CrossPackageEdge[];
  totalFiles: number;
  totalCycles: number;
  totalCrossPackageEdges: number;
}

// === Monorepo / Workspaces (0.13) ===

export type WorkspaceKind = 'npm' | 'yarn' | 'pnpm' | 'nx' | 'turbo' | 'lerna' | 'none';

export interface WorkspacePackage {
  /** package.json `name` field, or directory basename when missing. */
  name: string;
  /** Workspace-relative path of the package root (no leading `/`, no trailing `/`). */
  relativePath: string;
  /** package.json `version` if available. */
  version?: string;
  /** True when this is the workspace root itself. */
  isRoot: boolean;
}

export interface WorkspaceInfo {
  kind: WorkspaceKind;
  /** All packages, including the root if it has its own package.json. */
  packages: WorkspacePackage[];
  /** Source manifest used to discover packages, e.g. "package.json#workspaces" or "pnpm-workspace.yaml". */
  source?: string;
}

// === PR-Native AST Diff (0.12) ===

export interface ExportRename {
  from: string;
  to: string;
}

export interface FileAstDiff {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  exportsAdded: string[];
  exportsRemoved: string[];
  /**
   * Heuristically-detected renames (0.11). When an export disappears from
   * base AND a similar new name appears in head AND no other export matches,
   * we report it here instead of as a +/- pair. Removed/added lists exclude
   * any names that ended up in renames.
   */
  exportsRenamed: ExportRename[];
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

// === PR Review (0.13) ===

/**
 * One changed file enriched with risk signals. The agent calling
 * projscan_review uses these to decide which files need careful review.
 */
export interface ReviewFile {
  relativePath: string;
  status: 'added' | 'removed' | 'modified';
  /** Hotspot risk score for the head version. null when file isn't in the hotspot scope. */
  riskScore: number | null;
  /** Cyclomatic complexity at head. null when no AST adapter parsed it. */
  cyclomaticComplexity: number | null;
  /** Delta from the structural diff (mirrors FileAstDiff.cyclomaticDelta). null when file was added/removed. */
  cyclomaticDelta: number | null;
  /** Number of exports added in this PR. */
  exportsAdded: number;
  /** Number of exports removed in this PR. */
  exportsRemoved: number;
  /** Number of imports added. */
  importsAdded: number;
  /** Number of imports removed. */
  importsRemoved: number;
}

/**
 * A circular import that exists at head and either didn't exist at base or
 * grew. Surfaced separately from the file list so reviewers see at-a-glance
 * whether the PR introduces new architectural debt.
 */
export interface ReviewCycle {
  files: string[];
  size: number;
  /**
   * 'new' = no overlap with any base cycle; 'expanded' = at least one new
   * file added to an existing cycle.
   */
  classification: 'new' | 'expanded';
}

/**
 * A function whose CC newly crossed a worry threshold (>= 10) at head, or
 * was added with high CC, or jumped by 5+ since base.
 */
export interface ReviewFunction {
  file: string;
  name: string;
  line: number;
  endLine: number;
  cyclomaticComplexity: number;
  /** CC at base. null when the function did not exist at base. */
  baseCc: number | null;
  /** Why this function shows up. */
  reason: 'added' | 'jumped' | 'crossed-threshold';
}

/**
 * 1.6+ — A taint flow that is NEW at head (not present at base). Mirrors
 * the core TaintFlow shape but is intentionally light — review summaries
 * should be readable in a glance, so we drop the per-step file list and
 * keep only the source/sink, the function pair, and the path length.
 */
export interface ReviewTaintFlow {
  sourceFn: string;
  sinkFn: string;
  source: string;
  sink: string;
  /** Hop count from source function to sink function, inclusive of both ends. */
  pathLength: number;
  /** First and last files in the path; same value when length = 1. */
  files: string[];
}

/** Workspace-package-scoped dependency change. Aggregates root + workspaces. */
export interface ReviewDependencyChange {
  /** Workspace name; '' for the root manifest. */
  workspace: string;
  manifestFile: string;
  added: Array<{ name: string; version: string; kind: 'dep' | 'dev' }>;
  removed: Array<{ name: string; version: string; kind: 'dep' | 'dev' }>;
  bumped: Array<{ name: string; from: string; to: string; kind: 'dep' | 'dev' }>;
}

/**
 * 1.5+ — `projscan_review` can shape its response at three tiers based
 * on a `max_cost_tokens` budget passed by the caller: full (no budget
 * or large budget), summary (3K-7K tokens), verdict-only (<3K).
 * Selected by `selectReviewTier` and surfaced as the `tier` field on
 * the response.
 */
export type ReviewTier = 'full' | 'summary' | 'verdict-only';

export interface ReviewReport {
  available: boolean;
  reason?: string;
  base: { ref: string; resolvedSha: string | null };
  head: { ref: string; resolvedSha: string | null };
  /** The structural diff (same shape as projscan_pr_diff). */
  prDiff: PrDiffReport;
  /** Each changed file annotated with risk + CC + delta. Sorted by risk desc. */
  changedFiles: ReviewFile[];
  /** Cycles introduced or expanded by this PR. Empty when none. */
  newCycles: ReviewCycle[];
  /** Functions that meaningfully grew or were added with high CC. Sorted by CC desc. */
  riskyFunctions: ReviewFunction[];
  /** package.json deltas across root + workspaces. */
  dependencyChanges: ReviewDependencyChange[];
  /**
   * 1.6+ — NEW source-to-sink taint flows introduced by this PR. Each
   * entry is a flow that exists at head but didn't exist at base
   * (matched by sourceFn + sinkFn pair). Empty when taint is unavailable
   * (no per-function callSites at either side).
   */
  newTaintFlows: ReviewTaintFlow[];
  /** 'ok' = ship it; 'review' = needs careful look; 'block' = strongly suggests rework. */
  verdict: 'ok' | 'review' | 'block';
  /** One-line bullets explaining the verdict. */
  summary: string[];
  /**
   * 1.5+ — which tier this report was shaped at. Absent when the full
   * report is returned without budget shaping.
   */
  tier?: ReviewTier;
}

// === Impact / Reachability (0.15) ===

/**
 * One reachable file in an impact analysis. `distance` is BFS-hops from the
 * input target (1 = direct dependent, 2 = dependent-of-dependent, etc).
 * `target` itself is not included in the reachable list.
 */
export interface ImpactNode {
  file: string;
  distance: number;
  /**
   * 1.6+ — name of the registered repo that contains this file.
   * Present only when `cross_repo: true` was passed and the file
   * lives outside the source repo. Absent for in-repo entries.
   */
  repo?: string;
}

export interface ImpactReport {
  available: boolean;
  reason?: string;
  /** What was queried. */
  target: { kind: 'file' | 'symbol'; value: string };
  /**
   * For symbol mode: every file the graph claims defines the symbol. Empty
   * for file mode. Useful when an agent needs to know whether a name is
   * defined in multiple places before treating impact as authoritative.
   */
  definitionFiles: string[];
  /**
   * For symbol mode: files that directly call the symbol (their callSites
   * contains the name). The reachable set is computed from these as roots.
   * Empty for file mode.
   */
  directCallers: string[];
  /** Sorted by distance asc, then file asc. */
  reachable: ImpactNode[];
  /** Convenience count of reachable files (== reachable.length). */
  totalReachable: number;
  /**
   * 1.6+ — when cross-repo expansion ran, this is the per-repo
   * breakdown of reachable file counts. Absent when `cross_repo`
   * was false or the workspace had no siblings.
   */
  totalReachableByRepo?: Record<string, number>;
  /**
   * True when traversal hit `maxDistance` before exhausting the graph.
   * Items beyond the limit are omitted from `reachable`.
   */
  truncated: boolean;
  /** The maxDistance value used for the traversal. */
  maxDistance: number;
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
  /**
   * Per-function McCabe CC (0.13.0+). Sorted by cyclomaticComplexity desc.
   * Empty array when the file has no functions or the adapter doesn't yet
   * support per-function granularity.
   */
  functions?: FunctionDetail[];
}

/**
 * Per-function CC entry exposed via projscan_file. Mirrors the internal
 * `FunctionInfo` from `core/ast.ts` but is part of the stable API surface.
 */
export interface FunctionDetail {
  name: string;
  /** 1-based start line. */
  line: number;
  /** 1-based end line. */
  endLine: number;
  cyclomaticComplexity: number;
  /**
   * Approximate fan-in (0.15.0+): count of other files whose `callSites`
   * include this function's bare name. Name-based and approximate; absent
   * when the graph couldn't compute it.
   */
  fanIn?: number;
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
