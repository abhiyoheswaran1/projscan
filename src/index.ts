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
export { previewUpgrade } from './core/upgradePreview.js';
export { parseCoverage, coverageMap } from './core/coverageParser.js';
export { joinCoverageWithHotspots } from './core/coverageJoin.js';
export { parseSource, isParseable } from './core/ast.js';
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
export {
  buildSearchIndex,
  search,
  tokenize,
  expandQuery,
  attachExcerpts,
} from './core/searchIndex.js';
export { findDependencyLines } from './utils/packageJsonLocator.js';
export { parse as parseSemver, compare as compareSemver, drift as semverDrift } from './utils/semver.js';
export { walkFiles } from './utils/fileWalker.js';
export { loadConfig, applyConfigToIssues } from './utils/config.js';
export { getChangedFiles } from './utils/changedFiles.js';
export { issuesToSarif } from './reporters/sarifReporter.js';
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
} from './types.js';
