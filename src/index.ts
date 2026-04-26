export { scanRepository } from './core/repositoryScanner.js';
export { detectLanguages } from './core/languageDetector.js';
export { detectFrameworks } from './core/frameworkDetector.js';
export { analyzeDependencies } from './core/dependencyAnalyzer.js';
export { collectIssues } from './core/issueEngine.js';
export { analyzeHotspots, computeRiskScore } from './core/hotspotAnalyzer.js';
export { inspectFile } from './core/fileInspector.js';
export { buildImportGraph, toPackageName, isPackageUsed, filesImporting } from './core/importGraph.js';
export { detectOutdated } from './core/outdatedDetector.js';
export { runAudit, auditFindingsToIssues } from './core/auditRunner.js';
export { previewUpgrade, isValidPackageName } from './core/upgradePreview.js';
export { parseCoverage, coverageMap } from './core/coverageParser.js';
export { joinCoverageWithHotspots } from './core/coverageJoin.js';
export { parseSource, isParseable } from './core/ast.js';
export type { FunctionInfo } from './core/ast.js';
export {
  buildCodeGraph,
  filesImportingFile,
  filesImportingPackage,
  filesDefiningSymbol,
  exportsOf,
  importsOf,
  importersOf,
} from './core/codeGraph.js';
export { loadCachedGraph, saveCachedGraph, invalidateCache } from './core/indexCache.js';
export { applyBudget, estimateTokens } from './mcp/tokenBudget.js';
export { paginate, encodeCursor, decodeCursor, listChecksum, readPageParams } from './mcp/pagination.js';
export { toContentBlocks } from './mcp/chunker.js';
export { emitProgress, withProgress } from './mcp/progress.js';
export {
  buildSearchIndex,
  search,
  tokenize,
  expandQuery,
  attachExcerpts,
} from './core/searchIndex.js';
export {
  isSemanticAvailable,
  embedText,
  embedBatch,
  cosineSimilarity,
  DEFAULT_MODEL,
  EMBEDDING_DIM,
} from './core/embeddings.js';
export {
  buildSemanticIndex,
  semanticSearch,
  reciprocalRankFusion,
} from './core/semanticSearch.js';
export { findDependencyLines } from './utils/packageJsonLocator.js';
export { parse as parseSemver, compare as compareSemver, drift as semverDrift } from './utils/semver.js';
export { walkFiles } from './utils/fileWalker.js';
export { loadConfig, applyConfigToIssues } from './utils/config.js';
export { getChangedFiles } from './utils/changedFiles.js';
export { issuesToSarif } from './reporters/sarifReporter.js';
export { computeReview } from './core/review.js';
export { suggestFixForIssue, previewSuggestionForIssue, syntheticIssue, findIssue } from './core/fixSuggest.js';
export { explainIssue } from './core/explainIssue.js';
export { createMcpServer, runMcpServer } from './mcp/server.js';
export { getToolDefinitions } from './mcp/tools.js';
export { getPromptDefinitions } from './mcp/prompts.js';
export { getResourceDefinitions } from './mcp/resources.js';

export type {
  ScanResult,
  FileEntry,
  DirectoryNode,
  LanguageBreakdown,
  LanguageStat,
  FrameworkResult,
  DetectedFramework,
  DependencyReport,
  DependencyRisk,
  Issue,
  IssueLocation,
  IssueSeverity,
  Fix,
  FixResult,
  FileExplanation,
  FileInspection,
  FunctionDetail,
  ImportInfo,
  ExportInfo,
  ArchitectureLayer,
  AnalysisReport,
  ReportFormat,
  FileHotspot,
  HotspotReport,
  AuthorShare,
  BaselineHotspot,
  HotspotDelta,
  HotspotDiffSummary,
  McpToolDefinition,
  McpPromptDefinition,
  McpResourceDefinition,
  ProjscanConfig,
  LoadedConfig,
  SemverDrift,
  OutdatedPackage,
  OutdatedReport,
  AuditSeverity,
  AuditFinding,
  AuditReport,
  UpgradePreview,
  CoverageSource,
  FileCoverage,
  CoverageReport,
  CoverageJoinedHotspot,
  CoverageJoinedReport,
  ReviewReport,
  ReviewFile,
  ReviewCycle,
  ReviewFunction,
  ReviewDependencyChange,
  FixSuggestion,
  IssueExplanation,
  ImportPolicyRule,
} from './types.js';
